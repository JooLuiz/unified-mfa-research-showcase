/**
 * Handles authenticated order placement requests received through the event-mesh gateway.
 * Role: Adapts orders/requested messages to the placeOrder use case and replies with the outcome.
 * Not in this file: Placement steps (src/domain/placeOrder.js) or mesh ticket validation.
 * Key dependencies: src/domain/placeOrder.js; src/inbound/notificationEvents.js; event-mesh/gateway.
 * See also: src/server.js.
 *   On main the same use case is called from src/routes/orderRoutes.js (POST /orders).
 */

const {
  ORDER_PERSISTENCE_FAILED_CODE,
  ORDER_REQUEST_INVALID_CODE,
} = require("../domain/orderProcessing");
const { placeOrder } = require("../domain/placeOrder");
const { replyNotificationRaised } = require("./notificationEvents");

const ORDERS_TOPIC = "orders";
const ORDERS_REQUESTED_EVENT = "requested";
const ORDERS_ACCEPTED_EVENT = "accepted";

const ORDER_FAILURE_NOTIFICATIONS = Object.freeze({
  [ORDER_REQUEST_INVALID_CODE]: {
    type: "error",
    title: "Order not placed",
    message: "Your cart must include at least one item.",
  },
  [ORDER_PERSISTENCE_FAILED_CODE]: {
    type: "error",
    title: "Order not placed",
    message: "Your cart is still available. Please try again.",
  },
});

/**
 * Registers the gateway subscriber that processes orders/requested messages.
 *
 * @param {object} jsonStore - JSON store bound to service data files.
 * @param {{ broadcastEvent: (eventType: string, payload: object) => void }} adminEventStream - Publisher for admin live order updates.
 * @param {{ broadcastCartChanged: (userId: string, cart: object) => void }} cartEventStream - Notifies that user's watching clients after the cart row is removed.
 * @param {{ broadcastStockChanged: (productId: string, available: number) => void }} stockEventStream - Notifies stock watchers after the sold products' stock is decremented.
 * @param {{ broadcastNotificationChanged: (userId: string, shell: string, notification: object) => void }} notificationInboxEventStream - Publisher for durable inbox rows.
 * @returns {Promise<void>}
 * @sideEffects Subscribes to order request events on the local gateway singleton.
 */
async function registerOrderRequestHandler(
  jsonStore,
  adminEventStream,
  cartEventStream,
  stockEventStream,
  notificationInboxEventStream,
) {
  const gatewayModule = await import("event-mesh/gateway");
  const gateway = gatewayModule.default;

  gateway.subscribe(ORDERS_TOPIC, ORDERS_REQUESTED_EVENT, async (incomingMessage) => {
    const userId = incomingMessage.credential?.userId;
    if (!userId) {
      return;
    }

    const orderResult = await placeOrder({
      jsonStore,
      userId,
      payload: incomingMessage.payload,
      streams: {
        admin: adminEventStream,
        cart: cartEventStream,
        stock: stockEventStream,
        notificationInbox: notificationInboxEventStream,
      },
    });

    if (!orderResult.ok) {
      await replyNotificationRaised(
        incomingMessage,
        ORDER_FAILURE_NOTIFICATIONS[orderResult.code] ||
          ORDER_FAILURE_NOTIFICATIONS[ORDER_PERSISTENCE_FAILED_CODE],
      );
      return;
    }

    // Dedicated accept reply, mirroring orders/status-accepted in orderStatusHandler.js: this
    // only confirms the write succeeded. The "Order placed" toast comes from the persisted
    // notification inbox broadcast, not from this reply, so a customer never sees it twice.
    gateway.reply(incomingMessage, {
      topic: ORDERS_TOPIC,
      event: ORDERS_ACCEPTED_EVENT,
      payload: { order: orderResult.result },
    });
  });
}

module.exports = { registerOrderRequestHandler };
