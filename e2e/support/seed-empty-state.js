/**
 * Writes saved JSON so a spec can open an empty table, a chosen stock count, or one author's posts.
 * Role: Test-only file seeder. Specs call these after restoreMockData().
 * Not in this file: Live inserts or notification rows.
 * Key dependencies: apps/mock-data-service/data/orders.json; apps/mock-data-service/data/posts.json;
 *   apps/mock-data-service/data/products.json.
 * See also: e2e/support/reset-mock-data.js (must run before these seeds); e2e/admin/IR-ADMIN/IR-ADMIN-04.spec.js;
 *   e2e/ecommerce/IR-ORDER/IR-ORDER-06.spec.js; e2e/ecommerce/IR-CART/IR-CART-13.spec.js;
 *   e2e/ecommerce/IR-CART/IR-CART-14.spec.js; e2e/social/IR-SOCIAL/IR-SOCIAL-07.spec.js.
 */

const fs = require("fs/promises");
const path = require("path");

const DATA_DIRECTORY = path.resolve("apps/mock-data-service/data");

/**
 * Replaces the saved order list with an empty array.
 *
 * @returns {Promise<void>}
 * @sideEffects Writes apps/mock-data-service/data/orders.json. Must run after restoreMockData().
 */
async function seedEmptyOrders() {
  await fs.writeFile(
    path.join(DATA_DIRECTORY, "orders.json"),
    "[]\n",
    "utf8",
  );
}

/**
 * Replaces the saved post list with an empty array.
 *
 * @returns {Promise<void>}
 * @sideEffects Writes apps/mock-data-service/data/posts.json. Must run after restoreMockData().
 */
async function seedEmptyPosts() {
  await fs.writeFile(
    path.join(DATA_DIRECTORY, "posts.json"),
    "[]\n",
    "utf8",
  );
}

/**
 * Moves one saved order to a status the open page has not loaded yet.
 *
 * @param {string} orderId - Order id already stored in orders.json.
 * @param {string} status - Status the server should see on the next write.
 * @returns {Promise<void>}
 * @throws {Error} When that order id is not in the file.
 * @sideEffects Writes apps/mock-data-service/data/orders.json. Does not broadcast a live update.
 */
async function setStoredOrderStatus(orderId, status) {
  const ordersPath = path.join(DATA_DIRECTORY, "orders.json");
  const orders = JSON.parse(await fs.readFile(ordersPath, "utf8"));
  const matchingOrder = orders.find((orderRecord) => orderRecord.id === orderId);
  if (!matchingOrder) {
    throw new Error(`setStoredOrderStatus - unknown order: ${orderId}`);
  }
  matchingOrder.status = status;
  await fs.writeFile(ordersPath, `${JSON.stringify(orders, null, 2)}\n`, "utf8");
}

/**
 * Makes orders.json unreadable so the next place-order attempt fails on either transport.
 *
 * @returns {Promise<void>}
 * @sideEffects Writes apps/mock-data-service/data/orders.json. The next restoreMockData() repairs it.
 */
async function breakStoredOrders() {
  await fs.writeFile(
    path.join(DATA_DIRECTORY, "orders.json"),
    "{\n",
    "utf8",
  );
}

/**
 * Sets one product's stored stock. Available units are stock minus holds.
 *
 * @param {string} productId - Product id already stored in products.json.
 * @param {number} stock - Stock the server should report on the next read.
 * @returns {Promise<void>}
 * @throws {Error} When that product id is not in the file.
 * @sideEffects Writes apps/mock-data-service/data/products.json. Does not broadcast a live update.
 */
async function setProductStock(productId, stock) {
  const productsPath = path.join(DATA_DIRECTORY, "products.json");
  const products = JSON.parse(await fs.readFile(productsPath, "utf8"));
  const matchingProduct = products.find((productRecord) => productRecord.id === productId);
  if (!matchingProduct) {
    throw new Error(`setProductStock - unknown product: ${productId}`);
  }
  matchingProduct.stock = stock;
  await fs.writeFile(productsPath, `${JSON.stringify(products, null, 4)}\n`, "utf8");
}

/**
 * Leaves one author with the first N of their posts and keeps every other author.
 *
 * @param {string} authorId - Author id whose posts are trimmed.
 * @param {number} count - How many of that author's posts stay, in file order.
 * @returns {Promise<void>}
 * @sideEffects Writes apps/mock-data-service/data/posts.json. Must run after restoreMockData().
 */
async function setAuthorPostCount(authorId, count) {
  const postsPath = path.join(DATA_DIRECTORY, "posts.json");
  const posts = JSON.parse(await fs.readFile(postsPath, "utf8"));
  let keptAuthorPosts = 0;
  const nextPosts = posts.filter((postRecord) => {
    if (postRecord.authorId !== authorId) {
      return true;
    }
    keptAuthorPosts += 1;
    return keptAuthorPosts <= count;
  });
  await fs.writeFile(postsPath, `${JSON.stringify(nextPosts, null, 2)}\n`, "utf8");
}

module.exports = {
  seedEmptyOrders,
  seedEmptyPosts,
  setStoredOrderStatus,
  breakStoredOrders,
  setProductStock,
  setAuthorPostCount,
};
