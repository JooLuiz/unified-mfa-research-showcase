/**
 * Shared names for the order-status HTTP and SSE contract.
 * Role: Keeps the customer and admin clients on the same paths and event name as the mock API.
 * Not in this file: The EventSource lifecycle or the status write.
 * Key dependencies: None.
 * See also: apps/mock-data-service/src/routes/orderStatusRoutes.js.
 */

const ORDER_STATUS_CHANGED_EVENT_NAME = "orders.status-changed";
const CUSTOMER_ORDER_STATUS_TICKET_PATH = "/orders/connection-tickets";
const CUSTOMER_ORDER_STATUS_STREAM_PATH = "/orders/stream";
const ADMIN_ORDER_STATUS_TICKET_PATH = "/admin/orders/connection-tickets";
const ADMIN_ORDER_STATUS_STREAM_PATH = "/admin/orders/stream";

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
  ORDER_STATUS_CHANGED_EVENT_NAME,
  CUSTOMER_ORDER_STATUS_TICKET_PATH,
  CUSTOMER_ORDER_STATUS_STREAM_PATH,
  ADMIN_ORDER_STATUS_TICKET_PATH,
  ADMIN_ORDER_STATUS_STREAM_PATH,
  formatOrderStatus,
};
