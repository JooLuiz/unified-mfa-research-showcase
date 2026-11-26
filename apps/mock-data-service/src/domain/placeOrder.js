/**
 * Places an order for an authenticated user and notifies every watcher.
 * Role: One use case for order placement: user lookup, persistence, admin/cart/stock broadcasts,
 *   and inbox notifications.
 * Not in this file: Order persistence rules (src/domain/orderProcessing.js) or how a caller
 *   receives the outcome (HTTP status or gateway reply).
 * Key dependencies: src/domain/orderProcessing.js; src/domain/notificationTriggers.js;
 *   src/domain/useCaseCodes.js.
 * See also: src/routes/orderRoutes.js (POST /orders).
 */

const { buildPublicUser } = require("./auth");
const { createOrderForUser } = require("./orderProcessing");
const { recordOrderPlacedNotifications } = require("./notificationTriggers");
const { USER_NOT_FOUND_CODE, findUserById } = require("./useCaseCodes");

/**
 * Places one order.
 *
 * @param {{
 *   jsonStore: object,
 *   userId: string,
 *   payload: object | null | undefined,
 *   streams: {
 *     admin: { broadcastEvent: (eventType: string, payload: object) => void },
 *     cart: { broadcastCartChanged: (userId: string, cart: object) => void },
 *     stock: { broadcastStockChanged: (productId: string, available: number) => void },
 *     notificationInbox?: { broadcastNotificationChanged: (userId: string, shell: string, notification: object) => void },
 *   },
 * }} placeOrderInput - Store, caller, order payload, and broadcasters.
 * @returns {Promise<{ ok: true, result: object } | { ok: false, code: string }>} The stored order, or a failure code.
 * @sideEffects Writes orders.json, carts.json, products.json, and notificationInbox.json; broadcasts.
 */
async function placeOrder({ jsonStore, userId, payload, streams }) {
  const user = await findUserById(jsonStore, userId);
  if (!user) {
    return { ok: false, code: USER_NOT_FOUND_CODE };
  }

  const orderResult = await createOrderForUser({
    jsonStore,
    user,
    orderPayload: payload || {},
  });
  if (!orderResult.ok) {
    return orderResult;
  }

  streams.admin.broadcastEvent("order_created", {
    ...orderResult.order,
    customer: buildPublicUser(user),
  });
  streams.cart.broadcastCartChanged(user.id, {
    items: [],
    appliedCoupon: null,
    updatedAt: new Date().toISOString(),
  });
  // Defensive broadcast: decrementing stock and removing this user's hold by the same
  // quantity nets to no visible change in `available`, but every watcher stays consistent.
  orderResult.stockAvailability.forEach(({ productId, available }) => {
    streams.stock.broadcastStockChanged(productId, available);
  });

  if (streams.notificationInbox) {
    await recordOrderPlacedNotifications({
      jsonStore,
      notificationInboxEventStream: streams.notificationInbox,
      order: orderResult.order,
      user,
    });
  }

  return { ok: true, result: orderResult.order };
}

module.exports = { placeOrder };
