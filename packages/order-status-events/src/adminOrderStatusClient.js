/**
 * Admin order-status client for one admin tab.
 * Role: Opens the all-orders status stream and sends ship, deliver, cancel, accept, and decline writes.
 * Not in this file: Customer cancellation requests (src/customerOrderStatusClient.js) or table markup.
 * Key dependencies: src/createOrderStatusSession.js; src/requestOrderStatusChange.js.
 * See also: apps/admin-shell/src/main.js; apps/order-details/src/useOrderDetails.js.
 */

import { createOrderStatusStreamSession } from "./createOrderStatusSession.js";
import { requestOrderStatusChange } from "./requestOrderStatusChange.js";

const adminOrderStatusSession = createOrderStatusStreamSession();

/**
 * Opens this tab's admin order-status stream. A second call while it is open does nothing.
 *
 * @param {{ subscribe: Function }} transport - Admin event interface.
 * @returns {void}
 * @sideEffects Subscribes to orders/status-changed.
 */
function startAdminOrderStatusStream(transport) {
  adminOrderStatusSession.start(transport);
}

/**
 * Closes this tab's admin order-status stream.
 *
 * @returns {void}
 * @sideEffects Unsubscribes from the transport.
 */
function stopAdminOrderStatusStream() {
  adminOrderStatusSession.stop();
}

/**
 * Subscribes to every order's status changes.
 *
 * @param {(event: { orderId: string, status: string }) => void} listener - Called with each pushed status.
 * @returns {() => void} Unsubscribe function.
 * @sideEffects Registers the listener. The stream itself is owned by startAdminOrderStatusStream.
 */
function subscribeToAdminOrderStatusChanged(listener) {
  return adminOrderStatusSession.subscribe(listener);
}

/**
 * Asks the server to apply an admin status transition.
 *
 * @param {{ request: Function }} transport - Event interface.
 * @param {{ orderId: string, status: string }} changeInput - Order id and the next status.
 * @returns {Promise<{ ok: true, order: object } | { ok: false, code: string }>} Updated order, or a rejection code.
 * @sideEffects Sends orders/status-change with the admin actor.
 */
function requestAdminOrderStatusChange(transport, { orderId, status }) {
  return requestOrderStatusChange(transport, { orderId, status, actor: "admin" });
}

export {
  startAdminOrderStatusStream,
  stopAdminOrderStatusStream,
  subscribeToAdminOrderStatusChanged,
  requestAdminOrderStatusChange,
};
