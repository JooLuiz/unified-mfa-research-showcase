/**
 * Seeds a saved cart by writing carts.json directly, so the same e2e spec works on both
 * the HTTP-cart branch (main) and the Event-Mesh cart branch (mesh). Both transports end at
 * saveCartForUser, which writes this file; GET /api/cart and live availability both read it.
 * Role: Test-only cart seeder for the IR-CART specs.
 * Not in this file: Auth login, localStorage setup, or any HTTP/mesh transport.
 * Key dependencies: apps/mock-data-service/data/users.json; apps/mock-data-service/data/carts.json.
 * See also: e2e/support/reset-mock-data.js (must run before seedCart in beforeEach ordering).
 */

const fs = require("fs/promises");
const path = require("path");

const DATA_DIRECTORY = path.resolve("apps/mock-data-service/data");

/**
 * Resolves a username to its user id by reading users.json.
 *
 * @param {string} username - Username to look up (e.g. "bruno.silva").
 * @returns {Promise<string>} The matching user id.
 * @throws {Error} When no user matches the username.
 */
async function resolveUserId(username) {
  const users = JSON.parse(
    await fs.readFile(path.join(DATA_DIRECTORY, "users.json"), "utf8"),
  );
  const matchingUser = users.find((userRecord) => userRecord.username === username);
  if (!matchingUser) {
    throw new Error(`seedCart - unknown username: ${username}`);
  }
  return matchingUser.id;
}

/**
 * Replaces one user's saved cart row in carts.json with the given items and coupon.
 *
 * @param {string} username - Username whose cart is seeded (e.g. "bruno.silva").
 * @param {Array<{ productId: string, quantity: number }>} items - Cart lines to store.
 * @param {object | null} [appliedCoupon] - Coupon to store; defaults to null.
 * @returns {Promise<void>}
 * @sideEffects Writes apps/mock-data-service/data/carts.json. Must run after restoreMockData().
 */
async function seedCart(username, items, appliedCoupon = null) {
  const userId = await resolveUserId(username);
  const cartsPath = path.join(DATA_DIRECTORY, "carts.json");
  const carts = JSON.parse(await fs.readFile(cartsPath, "utf8"));
  const savedCart = {
    userId,
    items,
    appliedCoupon,
    updatedAt: new Date().toISOString(),
  };
  const matchingIndex = carts.findIndex((cartRecord) => cartRecord.userId === userId);
  if (matchingIndex === -1) {
    carts.push(savedCart);
  } else {
    carts[matchingIndex] = savedCart;
  }
  await fs.writeFile(cartsPath, `${JSON.stringify(carts, null, 2)}\n`, "utf8");
}

module.exports = { seedCart };
