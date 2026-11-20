/**
 * Customer order-status client for one ecommerce tab.
 * Role: Opens the signed-in customer's orders.status-changed stream and sends a cancellation request.
 * Not in this file: Admin actions (src/adminOrderStatusClient.js) or rendering.
 * Key dependencies: src/createOrderStatusSession.js; src/requestOrderStatusChange.js.
 * See also: apps/ecommerce-shell/src/main.js; apps/order-details/src/useOrderDetails.js.
 */

import { createOrderStatusStreamSession } from "./createOrderStatusSession.js";
import { requestOrderStatusChange } from "./requestOrderStatusChange.js";

const customerOrderStatusSession = createOrderStatusStreamSession();

/**
 * Opens this tab's customer order-status stream. A second call while it is open does nothing.
 *
 * @param {{ subscribe: Function }} transport - Ecommerce event interface.
 * @returns {void}
 * @sideEffects Subscribes to orders/status-changed.
 */
function startCustomerOrderStatusStream(transport) {
  customerOrderStatusSession.start(transport);
}

/**
 * Closes this tab's customer order-status stream.
 *
 * @returns {void}
 * @sideEffects Unsubscribes from the transport.
 */
function stopCustomerOrderStatusStream() {
  customerOrderStatusSession.stop();
}

/**
 * Subscribes to this customer's order status changes.
 *
 * @param {(event: { orderId: string, status: string }) => void} listener - Called with each pushed status.
 * @returns {() => void} Unsubscribe function.
 * @sideEffects Registers the listener. The stream itself is owned by startCustomerOrderStatusStream.
 */
function subscribeToOrderStatusChanged(listener) {
  return customerOrderStatusSession.subscribe(listener);
}

/**
 * Asks to cancel one of the signed-in customer's placed orders.
 *
 * @param {{ request: Function }} transport - Event interface.
 * @param {{ orderId: string }} requestInput - Order id.
 * @returns {Promise<{ ok: true, order: object } | { ok: false, code: string }>} Updated order, or a rejection code.
 * @sideEffects Sends orders/status-change with the customer actor.
 */
function requestOrderCancellation(transport, { orderId }) {
  return requestOrderStatusChange(transport, {
    orderId,
    status: "cancellation-requested",
    actor: "customer",
  });
}

export {
  startCustomerOrderStatusStream,
  stopCustomerOrderStatusStream,
  subscribeToOrderStatusChanged,
  requestOrderCancellation,
};
