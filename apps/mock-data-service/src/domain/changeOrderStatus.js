/**
 * Changes one order's status on behalf of a customer or an admin.
 * Role: One use case for status writes: user lookup, actor and ownership checks, transition,
 *   persistence, status/stock broadcasts, and inbox notifications.
 * Not in this file: Transition rules (src/domain/orderStatus.js) or how a caller receives the
 *   outcome (HTTP status or gateway reply).
 * Key dependencies: src/domain/orderStatus.js; src/domain/notificationTriggers.js;
 *   src/domain/useCaseCodes.js.
 * See also: src/routes/orderStatusRoutes.js (PUT /orders/:orderId/status).
 */

const { isAdminUser } = require("./auth");
const { applyOrderStatusChange } = require("./orderStatus");
const { recordOrderStatusChangedNotifications } = require("./notificationTriggers");
const {
  ADMIN_REQUIRED_CODE,
  INVALID_ACTOR_CODE,
  ORDER_NOT_FOUND_CODE,
  USER_NOT_FOUND_CODE,
  findUserById,
} = require("./useCaseCodes");

/**
 * Changes one order's status.
 *
 * The caller declares which capacity it is acting in. actor "customer" is granted only on the
 * caller's own order; actor "admin" is granted only to an admin-role user, on any order.
 *
 * @param {{
 *   jsonStore: object,
 *   userId: string,
 *   payload: { orderId?: unknown, status?: unknown, actor?: unknown } | null | undefined,
 *   streams: {
 *     orders: { broadcastStatusChanged: (userId: string, orderId: string, status: string) => void },
 *     stock: { broadcastStockChanged: (productId: string, available: number) => void },
 *     notificationInbox?: { broadcastNotificationChanged: (userId: string, shell: string, notification: object) => void },
 *   },
 * }} changeInput - Store, caller, requested change, and broadcasters.
 * @returns {Promise<{ ok: true, result: object } | { ok: false, code: string }>} The updated order, or a failure code.
 * @sideEffects Writes orders.json (and products.json on cancel) and notificationInbox.json; broadcasts.
 */
async function changeOrderStatus({ jsonStore, userId, payload, streams }) {
  const user = await findUserById(jsonStore, userId);
  if (!user) {
    return { ok: false, code: USER_NOT_FOUND_CODE };
  }

  const actor = payload?.actor;
  if (actor !== "admin" && actor !== "customer") {
    return { ok: false, code: INVALID_ACTOR_CODE };
  }

  const ordersData = await jsonStore.readJsonFileWithDefault("orders.json", []);
  const orderIndex = ordersData.findIndex((order) => order.id === payload.orderId);
  if (orderIndex < 0) {
    return { ok: false, code: ORDER_NOT_FOUND_CODE };
  }

  const currentOrder = ordersData[orderIndex];
  if (actor === "admin" && !isAdminUser(user)) {
    return { ok: false, code: ADMIN_REQUIRED_CODE };
  }
  if (actor === "customer" && currentOrder.userId !== user.id) {
    return { ok: false, code: ORDER_NOT_FOUND_CODE };
  }

  const changeResult = await applyOrderStatusChange({
    jsonStore,
    order: currentOrder,
    nextStatus: payload.status,
    actor,
  });
  if (!changeResult.ok) {
    return changeResult;
  }

  ordersData[orderIndex] = changeResult.order;
  await jsonStore.writeJsonFile("orders.json", ordersData);
  streams.orders.broadcastStatusChanged(
    changeResult.order.userId,
    changeResult.order.id,
    changeResult.order.status,
  );
  changeResult.stockAvailability.forEach(({ productId, available }) => {
    streams.stock.broadcastStockChanged(productId, available);
  });

  if (streams.notificationInbox) {
    await recordOrderStatusChangedNotifications({
      jsonStore,
      notificationInboxEventStream: streams.notificationInbox,
      order: changeResult.order,
      actor,
    });
  }

  return { ok: true, result: changeResult.order };
}

module.exports = { changeOrderStatus };
