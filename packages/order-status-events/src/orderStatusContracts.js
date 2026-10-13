/**
 * Shared names for the order-status Event Mesh contract.
 * Role: Keeps the customer and admin clients on the same mesh topics and event names as the
 *   mock data service's order-status handler and watcher registries.
 * Not in this file: The mesh publish/subscribe lifecycle or the status write.
 * Key dependencies: None.
 * See also: apps/mock-data-service/src/event-mesh/orderStatusHandler.js;
 *   apps/mock-data-service/src/infrastructure/orderEventStream.js.
 */

const ORDERS_TOPIC = "orders";
const ORDERS_WATCHING_EVENT = "watching";
const ORDERS_STATUS_CHANGE_REQUESTED_EVENT = "status-change-requested";
const ORDERS_STATUS_ACCEPTED_EVENT = "status-accepted";
const ORDERS_STATUS_REJECTED_EVENT = "status-rejected";
const ORDERS_STATUS_CHANGED_EVENT = "status-changed";

const ADMIN_TOPIC = "admin";
const ADMIN_ORDER_STATUS_CHANGED_EVENT = "order_status_changed";

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
  ORDERS_WATCHING_EVENT,
  ORDERS_STATUS_CHANGE_REQUESTED_EVENT,
  ORDERS_STATUS_ACCEPTED_EVENT,
  ORDERS_STATUS_REJECTED_EVENT,
  ORDERS_STATUS_CHANGED_EVENT,
  ADMIN_TOPIC,
  ADMIN_ORDER_STATUS_CHANGED_EVENT,
  formatOrderStatus,
};
