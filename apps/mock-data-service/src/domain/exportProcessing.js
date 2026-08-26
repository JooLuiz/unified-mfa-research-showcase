/**
 * Generates CSV export snapshots and updates in-memory export job state.
 * Role: Shared export processing for mesh request handlers and HTTP download routes.
 * Not in this file: HTTP routing, mesh replies, or job store definitions.
 * Key dependencies: JSON store; src/csv/csvSerializer.js; src/domain/exportJobs.js.
 * See also: src/event-mesh/exportRequestHandler.js; src/routes/exportRoutes.js.
 */

const { serializeCsv } = require("../csv/csvSerializer");
const {
  markExportJobCompleted,
  markExportJobFailed,
} = require("./exportJobs");

const EXPORT_KINDS = Object.freeze({
  orders: "orders",
  posts: "posts",
});

const EXPORT_FILE_NAMES = Object.freeze({
  [EXPORT_KINDS.orders]: "my-orders.csv",
  [EXPORT_KINDS.posts]: "my-posts.csv",
});

const EXPORT_GENERATION_FAILED_CODE = "export-generation-failed";
const INVALID_EXPORT_REQUEST_CODE = "invalid-export-request";

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

/**
 * Processes a queued export job and invokes mesh reply callbacks on completion.
 *
 * @param {{ jsonStore: object, exportJob: object, user: object, onCompleted: () => Promise<void>, onFailed: (code: string) => Promise<void> }} processingInput - Job context and outcome callbacks.
 * @returns {Promise<void>}
 * @sideEffects Updates the in-memory export job and triggers mesh reply callbacks.
 */
async function processExportJob({
  jsonStore,
  exportJob,
  user,
  onCompleted,
  onFailed,
}) {
  try {
    const csvContent = await buildExportCsv(jsonStore, exportJob.kind, user);
    markExportJobCompleted(exportJob.id, csvContent);
    await onCompleted();
  } catch (error) {
    console.error("processExportJob - error");
    console.error(error);
    markExportJobFailed(exportJob.id, EXPORT_GENERATION_FAILED_CODE);
    await onFailed(EXPORT_GENERATION_FAILED_CODE);
  }
}

module.exports = {
  EXPORT_KINDS,
  EXPORT_FILE_NAMES,
  EXPORT_GENERATION_FAILED_CODE,
  INVALID_EXPORT_REQUEST_CODE,
  buildExportCsv,
  processExportJob,
};
