/**
 * Builds CSV export content for authenticated users.
 * Role: Shared row-building and CSV serialization for order and post exports.
 * Not in this file: HTTP routing, CSV attachment headers, or async job state (this branch
 *   downloads CSV synchronously; see MESH_IMPLEMENTATIONS/csv-exports.md on mesh branches
 *   for the async job/gateway variant of this flow).
 * Key dependencies: JSON store; src/csv/csvSerializer.js.
 * See also: src/routes/exportRoutes.js.
 */

const { serializeCsv } = require("../csv/csvSerializer");

const EXPORT_KINDS = Object.freeze({
  orders: "orders",
  posts: "posts",
});

const EXPORT_FILE_NAMES = Object.freeze({
  [EXPORT_KINDS.orders]: "my-orders.csv",
  [EXPORT_KINDS.posts]: "my-posts.csv",
});

const ORDER_EXPORT_HEADERS = [
  "orderId",
  "placedAt",
  "productId",
  "productName",
  "quantity",
  "unitPrice",
  "subtotal",
  "discountAmount",
  "totalAmount",
  "couponCode",
  "shippingStreet",
  "shippingCity",
  "shippingState",
  "shippingPostalCode",
  "shippingCountry",
];

const POST_EXPORT_HEADERS = [
  "postId",
  "createdAt",
  "content",
  "imageUrl",
  "likes",
  "comments",
];

function buildOrderExportRows(orders) {
  return orders.flatMap((order) => {
    const items = Array.isArray(order.items) && order.items.length > 0
      ? order.items
      : [null];
    const shippingAddress = order.shippingAddress || {};

    return items.map((item) => [
      order.id,
      order.placedAt,
      item?.productId,
      item?.name,
      item?.quantity,
      item?.unitPrice,
      order.subtotal,
      order.discountAmount,
      order.totalAmount,
      order.appliedCoupon?.code,
      shippingAddress.street,
      shippingAddress.city,
      shippingAddress.state,
      shippingAddress.postalCode,
      shippingAddress.country,
    ]);
  });
}

function buildPostExportRows(posts) {
  return posts.map((post) => [
    post.id,
    post.createdAt,
    post.content,
    post.imageUrl,
    post.likes,
    post.comments,
  ]);
}

/**
 * Builds the CSV content for an authenticated export request.
 *
 * @param {{ readJsonFile: (fileName: string) => Promise<unknown>, readJsonFileWithDefault: (fileName: string, defaultValue: unknown) => Promise<unknown> }} jsonStore - JSON store bound to service data files.
 * @param {"orders" | "posts"} kind - Export kind requested by the client.
 * @param {{ id: string }} user - Authenticated user record.
 * @returns {Promise<string>} Serialized CSV content.
 */
async function buildExportCsv(jsonStore, kind, user) {
  if (kind === EXPORT_KINDS.orders) {
    const orders = await jsonStore.readJsonFileWithDefault("orders.json", []);
    const userOrders = orders.filter((order) => order.userId === user.id);
    return serializeCsv(ORDER_EXPORT_HEADERS, buildOrderExportRows(userOrders));
  }

  const posts = await jsonStore.readJsonFile("posts.json");
  const userPosts = posts.filter((post) => post.authorId === user.id);
  return serializeCsv(POST_EXPORT_HEADERS, buildPostExportRows(userPosts));
}

module.exports = {
  EXPORT_KINDS,
  EXPORT_FILE_NAMES,
  buildExportCsv,
};
