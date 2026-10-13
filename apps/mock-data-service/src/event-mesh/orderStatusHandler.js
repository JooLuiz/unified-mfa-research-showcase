/**
 * Handles authenticated order status writes received through the event-mesh gateway.
 * Role: Validates the actor and the transition, persists the result, replies to the sender,
 *   and broadcasts the new status to that customer's watchers and to every admin client.
 * Not in this file: Transition rules (src/domain/orderStatus.js) or the watcher registry
 *   (src/infrastructure/orderEventStream.js).
 * Key dependencies: JSON store; src/domain/orderStatus.js; src/infrastructure/orderEventStream.js;
 *   src/infrastructure/adminEventStream.js; src/infrastructure/stockEventStream.js.
 * See also: src/server.js; src/event-mesh/cartUpsertHandler.js (same reply/broadcast shape).
 */

const {
  ORDER_STATUS_NOT_ALLOWED_CODE,
  applyOrderStatusChange,
} = require("../domain/orderStatus");

const ORDERS_TOPIC = "orders";
const ORDERS_STATUS_CHANGE_REQUESTED_EVENT = "status-change-requested";
const ORDERS_STATUS_ACCEPTED_EVENT = "status-accepted";
const ORDERS_STATUS_REJECTED_EVENT = "status-rejected";
const ORDER_NOT_FOUND_CODE = "order-not-found";
const ADMIN_ORDER_STATUS_CHANGED_EVENT = "order_status_changed";

/**
 * Resolves the requesting actor from the message credential.
 *
 * @param {{ userId?: string, roles?: string[] }} credential - Gateway connection credential.
 * @returns {"admin" | "customer" | null} Actor role, or null for a guest credential.
 */
function resolveActor(credential) {
  if (!credential?.userId) {
    return null;
  }
  if (Array.isArray(credential.roles) && credential.roles.includes("admin")) {
    return "admin";
  }
  return "customer";
}

/**
 * Registers the gateway subscriber that processes orders/status-change-requested messages.
 *
 * @param {{ readJsonFileWithDefault: (fileName: string, defaultValue: unknown) => Promise<unknown>, writeJsonFile: (fileName: string, data: unknown) => Promise<void> }} jsonStore - JSON store bound to service data files.
 * @param {{ broadcastStatusChanged: (userId: string, orderId: string, status: string) => void }} orderEventStream - Notifies that customer's watching clients.
 * @param {{ broadcastEvent: (eventType: string, payload: object) => void }} adminEventStream - Notifies every connected admin client.
 * @param {{ broadcastStockChanged: (productId: string, available: number) => void }} stockEventStream - Notifies stock watchers after a cancellation restores stock.
 * @returns {Promise<void>}
 * @sideEffects Subscribes to order status change events on the local gateway singleton.
 */
async function registerOrderStatusHandler(jsonStore, orderEventStream, adminEventStream, stockEventStream) {
  const gatewayModule = await import("event-mesh/gateway");
  const gateway = gatewayModule.default;

  gateway.subscribe(ORDERS_TOPIC, ORDERS_STATUS_CHANGE_REQUESTED_EVENT, async (incomingMessage) => {
    const actor = resolveActor(incomingMessage.credential);
    const requestId = typeof incomingMessage.payload?.requestId === "string"
      ? incomingMessage.payload.requestId
      : null;
    const orderId = incomingMessage.payload?.orderId;
    const nextStatus = incomingMessage.payload?.nextStatus;

    if (!actor || !orderId) {
      gateway.reply(incomingMessage, {
        topic: ORDERS_TOPIC,
        event: ORDERS_STATUS_REJECTED_EVENT,
        payload: { requestId, code: ORDER_STATUS_NOT_ALLOWED_CODE },
      });
      return;
    }

    const ordersData = await jsonStore.readJsonFileWithDefault("orders.json", []);
    const orderIndex = ordersData.findIndex((order) => order.id === orderId);
    const currentOrder = orderIndex >= 0 ? ordersData[orderIndex] : null;

    if (!currentOrder || (actor !== "admin" && currentOrder.userId !== incomingMessage.credential.userId)) {
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
      actor,
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
  });
}

module.exports = { registerOrderStatusHandler };
