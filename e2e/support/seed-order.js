/**
 * Seeds a saved order by appending to orders.json, so the same e2e spec works on both
 * the HTTP-order branch (main) and the Event-Mesh order branch (mesh).
 * Role: Test-only order seeder for specs that load an order after it already exists.
 * Not in this file: Stock decrement, cart clearing, notification rows, or live status changes.
 * Key dependencies: apps/mock-data-service/data/users.json; apps/mock-data-service/data/orders.json.
 * See also: e2e/support/reset-mock-data.js (must run before seedOrder); e2e/support/seed-notification.js.
 */

const fs = require("fs/promises");
const path = require("path");

const DATA_DIRECTORY = path.resolve("apps/mock-data-service/data");

/**
 * Resolves a username to the stored user, including the shipping address.
 *
 * @param {string} username - Username to look up (e.g. "alice.parker").
 * @returns {Promise<{ id: string, address?: object | null }>} The matching user.
 * @throws {Error} When no user matches the username.
 */
async function resolveUser(username) {
  const users = JSON.parse(
    await fs.readFile(path.join(DATA_DIRECTORY, "users.json"), "utf8"),
  );
  const matchingUser = users.find((userRecord) => userRecord.username === username);
  if (!matchingUser) {
    throw new Error(`seedOrder - unknown username: ${username}`);
  }
  return matchingUser;
}

/**
 * Appends one placed order for the user.
 *
 * @param {string} username - Username who placed the order.
 * @param {{ id: string, items: object[], subtotal: number, discountAmount: number, totalAmount: number, appliedCoupon?: object | null }} orderInput - Order id, lines, and totals.
 * @returns {Promise<string>} The seeded order id.
 * @sideEffects Writes apps/mock-data-service/data/orders.json. Must run after restoreMockData().
 */
async function seedOrder(username, orderInput) {
  const user = await resolveUser(username);
  const ordersPath = path.join(DATA_DIRECTORY, "orders.json");
  const orders = JSON.parse(await fs.readFile(ordersPath, "utf8"));
  const savedOrder = {
    id: orderInput.id,
    userId: user.id,
    items: orderInput.items,
    subtotal: orderInput.subtotal,
    discountAmount: orderInput.discountAmount,
    totalAmount: orderInput.totalAmount,
    appliedCoupon: orderInput.appliedCoupon || null,
    shippingAddress: user.address || null,
    placedAt: new Date().toISOString(),
    status: "placed",
  };
  orders.push(savedOrder);
  await fs.writeFile(ordersPath, `${JSON.stringify(orders, null, 2)}\n`, "utf8");
  return savedOrder.id;
}

module.exports = { seedOrder };
