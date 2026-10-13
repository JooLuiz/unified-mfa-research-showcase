/**
 * Applies the order lifecycle shared by the customer and the admin.
 * Role: Validates one status transition, and restores product stock when the result is cancelled.
 * Not in this file: HTTP routing (src/routes/orderStatusRoutes.js) or the SSE registry
 *   (src/infrastructure/orderEventStream.js).
 * Key dependencies: src/domain/stock.js.
 * See also: src/domain/orderStatus.test.js; src/domain/orderProcessing.js.
 */

const { restoreStockForOrder } = require("./stock");

const ORDER_STATUS_INVALID_TRANSITION_CODE = "invalid-transition";
const ORDER_STATUS_NOT_ALLOWED_CODE = "not-allowed-for-actor";

const ORDER_STATUS_PLACED = "placed";
const ORDER_STATUS_CANCELLED = "cancelled";

const ORDER_STATUS_TRANSITIONS = [
  { from: "placed", to: "shipped", actor: "admin" },
  { from: "shipped", to: "delivered", actor: "admin" },
  { from: "placed", to: "cancelled", actor: "admin" },
  { from: "placed", to: "cancellation-requested", actor: "customer" },
  { from: "cancellation-requested", to: "cancelled", actor: "admin" },
  { from: "cancellation-requested", to: "placed", actor: "admin" },
];

/**
 * Reads an order's status, treating a missing value as placed so older orders.json rows
 * still move through the lifecycle.
 *
 * @param {object | null | undefined} order - Stored order.
 * @returns {string} Current status.
 */
function resolveOrderStatus(order) {
  if (typeof order?.status === "string" && order.status.trim() !== "") {
    return order.status;
  }
  return ORDER_STATUS_PLACED;
}

/**
 * Validates one status change and, when the result is cancelled, restores that order's stock.
 *
 * @param {{ jsonStore: object, order: object, nextStatus: string, actor: "admin" | "customer" }} changeInput - Store, current order, requested status, and who is asking.
 * @returns {Promise<{ ok: true, order: object, stockAvailability: Array<{ productId: string, available: number }> } | { ok: false, code: string }>} Updated order, or a rejection code. Stock is unchanged unless the result is cancelled.
 * @sideEffects Writes products.json only when the transition ends in cancelled and the restore succeeds.
 */
async function applyOrderStatusChange({ jsonStore, order, nextStatus, actor }) {
  const currentStatus = resolveOrderStatus(order);
  const matchingTransition = ORDER_STATUS_TRANSITIONS.find(
    (transition) => transition.from === currentStatus && transition.to === nextStatus,
  );
  if (!matchingTransition) {
    return { ok: false, code: ORDER_STATUS_INVALID_TRANSITION_CODE };
  }
  if (matchingTransition.actor !== actor) {
    return { ok: false, code: ORDER_STATUS_NOT_ALLOWED_CODE };
  }

  let stockAvailability = [];
  if (nextStatus === ORDER_STATUS_CANCELLED) {
    const restoreResult = await restoreStockForOrder({ jsonStore, items: order.items });
    if (!restoreResult.ok) {
      return restoreResult;
    }
    stockAvailability = restoreResult.affectedProducts;
  }

  return {
    ok: true,
    order: { ...order, status: nextStatus },
    stockAvailability,
  };
}

module.exports = {
  ORDER_STATUS_INVALID_TRANSITION_CODE,
  ORDER_STATUS_NOT_ALLOWED_CODE,
  ORDER_STATUS_TRANSITIONS,
  resolveOrderStatus,
  applyOrderStatusChange,
};
