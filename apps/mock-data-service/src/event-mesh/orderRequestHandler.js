/**
 * Handles authenticated order placement requests received through the event-mesh gateway.
 * Role: Persists orders from mesh requests and replies with targeted notifications.
 * Not in this file: HTTP order routes or mesh ticket validation.
 * Key dependencies: JSON store; src/domain/orderProcessing.js; src/event-mesh/notificationEvents.js;
 *   src/infrastructure/adminEventStream.js.
 * See also: src/server.js.
 */

const { buildPublicUser } = require("../domain/auth");
const {
  ORDER_PERSISTENCE_FAILED_CODE,
  ORDER_REQUEST_INVALID_CODE,
  createOrderForUser,
} = require("../domain/orderProcessing");
const { replyNotificationRaised } = require("./notificationEvents");

const ORDER_SUCCESS_NOTIFICATION = Object.freeze({
  type: "success",
  title: "Order placed",
  message: "Your order has been created successfully.",
});

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
 * Registers the gateway subscriber that processes orders.requested messages.
 *
 * @param {{ readJsonFile: (fileName: string) => Promise<unknown>, readJsonFileWithDefault: (fileName: string, defaultValue: unknown) => Promise<unknown>, writeJsonFile: (fileName: string, data: unknown) => Promise<void> }} jsonStore - JSON store bound to service data files.
 * @param {{ broadcastEvent: (eventType: string, payload: object) => void }} adminEventStream - Publisher for admin live order updates.
 * @param {{ broadcastCartChanged: (userId: string, cart: object) => void }} cartEventStream - Notifies that user's watching clients after the cart row is removed.
 * @param {{ broadcastStockChanged: (productId: string, available: number) => void }} stockEventStream - Notifies stock watchers after the sold products' stock is decremented.
 * @returns {Promise<void>}
 * @sideEffects Subscribes to order request events on the local gateway singleton.
 */
async function registerOrderRequestHandler(jsonStore, adminEventStream, cartEventStream, stockEventStream) {
  const gatewayModule = await import("event-mesh/gateway");
  const gateway = gatewayModule.default;

  gateway.subscribe("orders", "requested", async (incomingMessage) => {
    const userId = incomingMessage.credential?.userId;
    if (!userId) {
      return;
    }

    const users = await jsonStore.readJsonFile("users.json");
    const user = users.find((userRecord) => userRecord.id === userId);
    if (!user) {
      await replyNotificationRaised(
        incomingMessage,
        ORDER_FAILURE_NOTIFICATIONS[ORDER_PERSISTENCE_FAILED_CODE],
      );
      return;
    }

    const orderResult = await createOrderForUser({
      jsonStore,
      user,
      orderPayload: incomingMessage.payload || {},
    });

    if (!orderResult.ok) {
      await replyNotificationRaised(
        incomingMessage,
        ORDER_FAILURE_NOTIFICATIONS[orderResult.code] ||
          ORDER_FAILURE_NOTIFICATIONS[ORDER_PERSISTENCE_FAILED_CODE],
      );
      return;
    }

    await replyNotificationRaised(incomingMessage, ORDER_SUCCESS_NOTIFICATION);
    adminEventStream.broadcastEvent("order_created", {
      ...orderResult.order,
      customer: buildPublicUser(user),
    });
    cartEventStream.broadcastCartChanged(user.id, {
      items: [],
      appliedCoupon: null,
      updatedAt: new Date().toISOString(),
    });
    // Defensive broadcast: decrementing stock and removing this user's hold by the same
    // quantity nets to no visible change in `available`, but every watcher stays consistent.
    orderResult.stockAvailability.forEach(({ productId, available }) => {
      stockEventStream.broadcastStockChanged(productId, available);
    });
  });
}

module.exports = { registerOrderRequestHandler };
