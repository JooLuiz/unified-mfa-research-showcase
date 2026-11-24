/**
 * Shared names for the order-status contract.
 * Role: Keeps the customer and admin clients on the same topic, event name, and status labels as the mock API.
 * Not in this file: Paths (packages/server-events/src/eventEndpoints.js), the live connection, or
 *   the status write. Both live behind the injected transport.
 * Key dependencies: None.
 * See also: main: apps/mock-data-service/src/routes/orderStatusRoutes.js;
 *   mesh: apps/mock-data-service/src/inbound/orderStatusHandler.js.
 */

const ORDERS_TOPIC = "orders";
const ORDERS_STATUS_CHANGED_EVENT = "status-changed";
const ORDER_STATUS_CHANGED_EVENT_NAME = "orders.status-changed";

const ORDER_STATUS_LABELS = {
  placed: "Placed",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  "cancellation-requested": "Cancellation requested",
};

/**
 * Returns a short label for an order status. A missing status is placed.
 *
 * @param {string | null | undefined} status - Stored order status.
 * @returns {string} Display label.
 */
function formatOrderStatus(status) {
  if (typeof status !== "string" || status.trim() === "") {
    return ORDER_STATUS_LABELS.placed;
  }
  return ORDER_STATUS_LABELS[status] || status;
}

export {
  ORDERS_TOPIC,
  ORDERS_STATUS_CHANGED_EVENT,
  ORDER_STATUS_CHANGED_EVENT_NAME,
  formatOrderStatus,
};
