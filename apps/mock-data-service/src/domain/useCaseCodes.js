/**
 * Shared failure codes and lookups for the server use cases.
 * Role: Names the checks a use case owns before it calls a domain function, so every caller
 *   (HTTP route or gateway handler) maps the same code set.
 * Not in this file: Domain rule codes (orderProcessing.js, orderStatus.js, postLikes.js, stock.js,
 *   cartProcessing.js, notificationInbox.js) — use cases pass those through unchanged.
 * Key dependencies: users.json via the JSON store.
 * See also: src/domain/placeOrder.js; src/domain/changeOrderStatus.js; src/domain/togglePostLike.js.
 */

const USER_NOT_FOUND_CODE = "user-not-found";
const POST_NOT_FOUND_CODE = "post-not-found";
const ORDER_NOT_FOUND_CODE = "order-not-found";
const INVALID_ACTOR_CODE = "invalid-actor";
const ADMIN_REQUIRED_CODE = "admin-required";
const STOCK_HOLDER_MISSING_CODE = "stock-holder-missing";
const INVALID_REQUEST_CODE = "invalid-request";

/**
 * Finds one user record by id.
 *
 * @param {{ readJsonFile: (fileName: string) => Promise<Array<{ id: string }>> }} jsonStore - JSON file store.
 * @param {string | null | undefined} userId - User to find.
 * @returns {Promise<object | null>} Matching user record, or null.
 */
async function findUserById(jsonStore, userId) {
  const usersData = await jsonStore.readJsonFile("users.json");
  return usersData.find((userRecord) => userRecord.id === userId) || null;
}

module.exports = {
  ADMIN_REQUIRED_CODE,
  INVALID_ACTOR_CODE,
  INVALID_REQUEST_CODE,
  ORDER_NOT_FOUND_CODE,
  POST_NOT_FOUND_CODE,
  STOCK_HOLDER_MISSING_CODE,
  USER_NOT_FOUND_CODE,
  findUserById,
};
