/**
 * Handles authenticated order status writes received through the event-mesh gateway.
 * Role: Adapts orders/status-change-requested messages to the changeOrderStatus use case,
 *   replies accepted or rejected, and adds the admin live-table broadcast.
 * Not in this file: Status-change steps (src/domain/changeOrderStatus.js) or the watcher
 *   registry (src/infrastructure/orderEvents.js).
 * Key dependencies: src/domain/changeOrderStatus.js; src/domain/useCaseCodes.js; event-mesh/gateway.
 * See also: src/server.js; src/inbound/cartUpsertHandler.js (same reply shape).
 *   On main the same use case is called from src/routes/orderStatusRoutes.js.
 */

const { changeOrderStatus } = require("../domain/changeOrderStatus");
const {
  ADMIN_REQUIRED_CODE,
  INVALID_ACTOR_CODE,
  ORDER_NOT_FOUND_CODE,
  USER_NOT_FOUND_CODE,
} = require("../domain/useCaseCodes");

const ORDERS_TOPIC = "orders";
const ORDERS_STATUS_CHANGE_REQUESTED_EVENT = "status-change-requested";
const ORDERS_STATUS_ACCEPTED_EVENT = "status-accepted";
const ORDERS_STATUS_REJECTED_EVENT = "status-rejected";
const ADMIN_ORDER_STATUS_CHANGED_EVENT = "order_status_changed";

// Reply codes the shells already handle. An unknown user or a refused admin claim reads as a
// missing order, so the reply does not reveal which orders exist.
const REJECTED_REPLY_CODES = Object.freeze({
  [USER_NOT_FOUND_CODE]: ORDER_NOT_FOUND_CODE,
  [ADMIN_REQUIRED_CODE]: ORDER_NOT_FOUND_CODE,
});

/**
 * Registers the gateway subscriber that processes orders/status-change-requested messages.
 *
 * @param {object} jsonStore - JSON store bound to service data files.
 * @param {{ broadcastStatusChanged: (userId: string, orderId: string, status: string) => void }} orderEventStream - Notifies that customer's watching clients.
 * @param {{ broadcastEvent: (eventType: string, payload: object) => void }} adminEventStream - Notifies every connected admin client.
 * @param {{ broadcastStockChanged: (productId: string, available: number) => void }} stockEventStream - Notifies stock watchers after a cancellation restores stock.
 * @param {{ broadcastNotificationChanged: (userId: string, shell: string, notification: object) => void }} notificationInboxEventStream - Publisher for durable inbox rows.
 * @returns {Promise<void>}
 * @sideEffects Subscribes to order status change events on the local gateway singleton.
 */
async function registerOrderStatusHandler(
  jsonStore,
  orderEventStream,
  adminEventStream,
  stockEventStream,
  notificationInboxEventStream,
) {
  const gatewayModule = await import("event-mesh/gateway");
  const gateway = gatewayModule.default;

  // Fans the use case's status broadcast out to the customer's watchers and every admin client.
  const statusBroadcaster = {
    broadcastStatusChanged(userId, orderId, status) {
      orderEventStream.broadcastStatusChanged(userId, orderId, status);
      adminEventStream.broadcastEvent(ADMIN_ORDER_STATUS_CHANGED_EVENT, { orderId, status });
    },
  };

  gateway.subscribe(ORDERS_TOPIC, ORDERS_STATUS_CHANGE_REQUESTED_EVENT, async (incomingMessage) => {
    const userId = incomingMessage.credential?.userId;
    const requestId = typeof incomingMessage.payload?.requestId === "string"
      ? incomingMessage.payload.requestId
      : null;

    const changeResult = userId
      ? await changeOrderStatus({
          jsonStore,
          userId,
          payload: {
            orderId: incomingMessage.payload?.orderId,
            status: incomingMessage.payload?.nextStatus,
            actor: incomingMessage.payload?.actor,
          },
          streams: {
            orders: statusBroadcaster,
            stock: stockEventStream,
            notificationInbox: notificationInboxEventStream,
          },
        })
      : { ok: false, code: INVALID_ACTOR_CODE };

    if (!changeResult.ok) {
      gateway.reply(incomingMessage, {
        topic: ORDERS_TOPIC,
        event: ORDERS_STATUS_REJECTED_EVENT,
        payload: { requestId, code: REJECTED_REPLY_CODES[changeResult.code] || changeResult.code },
      });
      return;
    }

    gateway.reply(incomingMessage, {
      topic: ORDERS_TOPIC,
      event: ORDERS_STATUS_ACCEPTED_EVENT,
      payload: { requestId, order: changeResult.result },
    });
  });
}

module.exports = { registerOrderStatusHandler };
