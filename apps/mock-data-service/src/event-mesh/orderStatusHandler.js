/**
 * Handles authenticated order status writes received through the event-mesh gateway.
 * Role: Validates the actor and the transition, persists the result, replies to the sender,
 *   and broadcasts the new status to that customer's watchers and to every admin client.
 * Not in this file: Transition rules (src/domain/orderStatus.js) or the watcher registry
 *   (src/infrastructure/orderEventStream.js).
 * Key dependencies: JSON store; src/domain/orderStatus.js; src/infrastructure/orderEventStream.js;
 *   src/infrastructure/adminEventStream.js; src/infrastructure/stockEventStream.js;
 *   src/domain/notificationTriggers.js.
 * See also: src/server.js; src/event-mesh/cartUpsertHandler.js (same reply/broadcast shape).
 */

const {
  ORDER_STATUS_NOT_ALLOWED_CODE,
  applyOrderStatusChange,
} = require("../domain/orderStatus");
const { recordOrderStatusChangedNotifications } = require("../domain/notificationTriggers");

const ORDERS_TOPIC = "orders";
const ORDERS_STATUS_CHANGE_REQUESTED_EVENT = "status-change-requested";
const ORDERS_STATUS_ACCEPTED_EVENT = "status-accepted";
const ORDERS_STATUS_REJECTED_EVENT = "status-rejected";
const ORDER_NOT_FOUND_CODE = "order-not-found";
const INVALID_ACTOR_CODE = "invalid-actor";
const ADMIN_ORDER_STATUS_CHANGED_EVENT = "order_status_changed";

/**
 * Checks whether the gateway credential may act as admin.
 *
 * The credential is `{ userId, roles }`, not a user record, so this does not call isAdminUser.
 *
 * @param {{ roles?: string[] } | null | undefined} credential - Gateway connection credential.
 * @returns {boolean} True when the credential includes the admin role.
 */
function credentialIsAdmin(credential) {
  return Array.isArray(credential?.roles) && credential.roles.includes("admin");
}

/**
 * Registers the gateway subscriber that processes orders/status-change-requested messages.
 *
 * @param {{ readJsonFileWithDefault: (fileName: string, defaultValue: unknown) => Promise<unknown>, writeJsonFile: (fileName: string, data: unknown) => Promise<void> }} jsonStore - JSON store bound to service data files.
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

  gateway.subscribe(ORDERS_TOPIC, ORDERS_STATUS_CHANGE_REQUESTED_EVENT, async (incomingMessage) => {
    const credential = incomingMessage.credential;
    const requestedActor = incomingMessage.payload?.actor;
    const requestId = typeof incomingMessage.payload?.requestId === "string"
      ? incomingMessage.payload.requestId
      : null;
    const orderId = incomingMessage.payload?.orderId;
    const nextStatus = incomingMessage.payload?.nextStatus;

    if (!credential?.userId || !orderId || (requestedActor !== "admin" && requestedActor !== "customer")) {
      gateway.reply(incomingMessage, {
        topic: ORDERS_TOPIC,
        event: ORDERS_STATUS_REJECTED_EVENT,
        payload: {
          requestId,
          code: requestedActor === "admin" || requestedActor === "customer"
            ? ORDER_STATUS_NOT_ALLOWED_CODE
            : INVALID_ACTOR_CODE,
        },
      });
      return;
    }

    if (requestedActor === "admin" && !credentialIsAdmin(credential)) {
      gateway.reply(incomingMessage, {
        topic: ORDERS_TOPIC,
        event: ORDERS_STATUS_REJECTED_EVENT,
        payload: { requestId, code: ORDER_NOT_FOUND_CODE },
      });
      return;
    }

    const ordersData = await jsonStore.readJsonFileWithDefault("orders.json", []);
    const orderIndex = ordersData.findIndex((order) => order.id === orderId);
    const currentOrder = orderIndex >= 0 ? ordersData[orderIndex] : null;

    if (!currentOrder || (requestedActor === "customer" && currentOrder.userId !== credential.userId)) {
      gateway.reply(incomingMessage, {
        topic: ORDERS_TOPIC,
        event: ORDERS_STATUS_REJECTED_EVENT,
        payload: { requestId, code: ORDER_NOT_FOUND_CODE },
      });
      return;
    }

    const changeResult = await applyOrderStatusChange({
      jsonStore,
      order: currentOrder,
      nextStatus,
      actor: requestedActor,
    });

    if (!changeResult.ok) {
      gateway.reply(incomingMessage, {
        topic: ORDERS_TOPIC,
        event: ORDERS_STATUS_REJECTED_EVENT,
        payload: { requestId, code: changeResult.code },
      });
      return;
    }

    ordersData[orderIndex] = changeResult.order;
    await jsonStore.writeJsonFile("orders.json", ordersData);

    gateway.reply(incomingMessage, {
      topic: ORDERS_TOPIC,
      event: ORDERS_STATUS_ACCEPTED_EVENT,
      payload: { requestId, order: changeResult.order },
    });

    orderEventStream.broadcastStatusChanged(
      changeResult.order.userId,
      changeResult.order.id,
      changeResult.order.status,
    );
    adminEventStream.broadcastEvent(ADMIN_ORDER_STATUS_CHANGED_EVENT, {
      orderId: changeResult.order.id,
      status: changeResult.order.status,
    });
    changeResult.stockAvailability.forEach(({ productId, available }) => {
      stockEventStream.broadcastStockChanged(productId, available);
    });
    await recordOrderStatusChangedNotifications({
      jsonStore,
      notificationInboxEventStream,
      order: changeResult.order,
      actor: requestedActor,
    });
  });
}

module.exports = { registerOrderStatusHandler };
