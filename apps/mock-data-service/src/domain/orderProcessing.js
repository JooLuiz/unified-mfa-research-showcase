/**
 * Persists authenticated orders for the mock data service.
 * Role: Validates order payloads and writes new orders to orders.json.
 * Not in this file: HTTP routing or id generation (src/domain/identifiers.js).
 * Key dependencies: JSON store; src/domain/identifiers.js.
 * See also: src/routes/orderRoutes.js.
 */

const { generateIdentifier } = require("./identifiers");

const ORDER_REQUEST_INVALID_CODE = "invalid-order-request";
const ORDER_PERSISTENCE_FAILED_CODE = "order-persistence-failed";

/**
 * Creates and persists a new order for an authenticated user.
 *
 * @param {{ jsonStore: { readJsonFile: (fileName: string) => Promise<unknown>, readJsonFileWithDefault: (fileName: string, defaultValue: unknown) => Promise<unknown>, writeJsonFile: (fileName: string, data: unknown) => Promise<void> }, user: { id: string, address?: object | null }, orderPayload: object }} processingInput - Store, user, and request payload.
 * @returns {Promise<{ ok: true, order: object } | { ok: false, code: string }>} Persistence outcome.
 */
async function createOrderForUser({ jsonStore, user, orderPayload }) {
  const orderItems = Array.isArray(orderPayload.items) ? orderPayload.items : [];
  if (orderItems.length === 0) {
    return { ok: false, code: ORDER_REQUEST_INVALID_CODE };
  }

  const newOrder = {
    id: generateIdentifier("order"),
    userId: user.id,
    items: orderItems,
    subtotal: Number(orderPayload.subtotal) || 0,
    discountAmount: Number(orderPayload.discountAmount) || 0,
    totalAmount: Number(orderPayload.totalAmount) || 0,
    appliedCoupon: orderPayload.appliedCoupon || null,
    shippingAddress:
      orderPayload.shippingAddress || user.address || null,
    placedAt: new Date().toISOString(),
  };

  try {
    const ordersData = await jsonStore.readJsonFileWithDefault("orders.json", []);
    ordersData.push(newOrder);
    await jsonStore.writeJsonFile("orders.json", ordersData);
    return { ok: true, order: newOrder };
  } catch (error) {
    console.error("createOrderForUser - error");
    console.error(error);
    return { ok: false, code: ORDER_PERSISTENCE_FAILED_CODE };
  }
}

module.exports = {
  ORDER_REQUEST_INVALID_CODE,
  ORDER_PERSISTENCE_FAILED_CODE,
  createOrderForUser,
};
