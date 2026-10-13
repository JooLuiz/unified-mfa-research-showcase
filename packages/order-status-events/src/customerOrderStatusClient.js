/**
 * Customer order-status client for one ecommerce tab.
 * Role: Announces this tab on orders/watching, exposes the signed-in customer's own
 *   orders/status-changed stream, and sends a cancellation request.
 * Not in this file: Admin actions (src/adminOrderStatusClient.js) or rendering.
 * Key dependencies: src/createOrderStatusWatchSession.js; src/requestOrderStatusChange.js.
 * See also: apps/ecommerce-shell/src/main.js; apps/order-details/src/useOrderDetails.js.
 */

import {
  ORDERS_TOPIC,
  ORDERS_STATUS_CHANGED_EVENT,
  ORDERS_WATCHING_EVENT,
} from "./orderStatusContracts.js";
import { createOrderStatusWatchSession } from "./createOrderStatusWatchSession.js";
import { requestOrderStatusChange } from "./requestOrderStatusChange.js";

const customerOrderStatusSession = createOrderStatusWatchSession({
  topic: ORDERS_TOPIC,
  watchingEvent: ORDERS_WATCHING_EVENT,
  statusChangedEvent: ORDERS_STATUS_CHANGED_EVENT,
  logName: "startCustomerOrderStatusStream",
});

/**
 * Opens this tab's customer order-status watch session. A second call while it is open does nothing.
 *
 * @param {{ apiBaseUrl?: string, authToken?: string }} [startInput] - `authToken` gates the
 *   start, matching the HTTP branch's guard; `apiBaseUrl` is accepted and unused since the open
 *   mesh connection already carries the credential.
 * @returns {Promise<void>}
 * @sideEffects Publishes orders/watching on an interval and subscribes to orders/status-changed.
 */
function startCustomerOrderStatusStream(startInput) {
  if (!startInput?.authToken) {
    return Promise.resolve();
  }
  return customerOrderStatusSession.start();
}

/**
 * Closes this tab's customer order-status watch session.
 *
 * @returns {void}
 * @sideEffects Clears the watching interval and removes the mesh subscription.
 */
function stopCustomerOrderStatusStream() {
  customerOrderStatusSession.stop();
}

/**
 * Subscribes to this customer's order status changes.
 *
 * @param {(event: { orderId: string, status: string }) => void} listener - Called with each pushed status.
 * @returns {() => void} Unsubscribe function.
 * @sideEffects Registers the listener. The session itself is owned by startCustomerOrderStatusStream.
 */
function subscribeToOrderStatusChanged(listener) {
  return customerOrderStatusSession.subscribe(listener);
}

/**
 * Asks to cancel one of the signed-in customer's placed orders.
 *
 * @param {{ apiBaseUrl?: string, authToken?: string, orderId: string }} requestInput - Order id.
 *   `apiBaseUrl`/`authToken` are accepted for call-site compatibility and unused.
 * @returns {Promise<{ ok: true, order: object } | { ok: false, code: string }>} Updated order, or a rejection code.
 * @sideEffects Publishes orders/status-change-requested with nextStatus cancellation-requested.
 */
function requestOrderCancellation({ orderId }) {
  return requestOrderStatusChange({
    orderId,
    status: "cancellation-requested",
  });
}

export {
  startCustomerOrderStatusStream,
  stopCustomerOrderStatusStream,
  subscribeToOrderStatusChanged,
  requestOrderCancellation,
};
