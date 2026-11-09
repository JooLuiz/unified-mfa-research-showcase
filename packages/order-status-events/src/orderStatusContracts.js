/**
 * Shared names for the order-status Event Mesh contract and the HTTP/SSE paths.
 * Role: Keeps mesh clients and the SSE session on the same topic and event names as the mock API.
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
const ORDER_STATUS_CHANGED_EVENT_NAME = "orders.status-changed";
const CUSTOMER_ORDER_STATUS_TICKET_PATH = "/orders/connection-tickets";
const CUSTOMER_ORDER_STATUS_STREAM_PATH = "/orders/stream";
const ADMIN_ORDER_STATUS_TICKET_PATH = "/admin/orders/connection-tickets";
const ADMIN_ORDER_STATUS_STREAM_PATH = "/admin/orders/stream";

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
  ADMIN_ORDER_STATUS_CHANGED_EVENT,
  ADMIN_ORDER_STATUS_STREAM_PATH,
  ADMIN_ORDER_STATUS_TICKET_PATH,
  ADMIN_TOPIC,
  CUSTOMER_ORDER_STATUS_STREAM_PATH,
  CUSTOMER_ORDER_STATUS_TICKET_PATH,
  ORDER_STATUS_CHANGED_EVENT_NAME,
  ORDERS_STATUS_ACCEPTED_EVENT,
  ORDERS_STATUS_CHANGED_EVENT,
  ORDERS_STATUS_CHANGE_REQUESTED_EVENT,
  ORDERS_STATUS_REJECTED_EVENT,
  ORDERS_TOPIC,
  ORDERS_WATCHING_EVENT,
  formatOrderStatus,
};
