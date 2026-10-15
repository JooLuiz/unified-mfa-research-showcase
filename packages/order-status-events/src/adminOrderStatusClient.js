/**
 * Admin order-status client for one admin tab.
 * Role: Opens the all-orders status stream and sends ship, deliver, cancel, accept, and decline writes.
 * Not in this file: Customer cancellation requests (src/customerOrderStatusClient.js) or table markup.
 * Key dependencies: src/createOrderStatusStreamSession.js; src/requestOrderStatusChange.js.
 * See also: apps/admin-shell/src/main.js; apps/admin-shell/src/pages/ordersPage.js.
 */

import {
  ADMIN_ORDER_STATUS_STREAM_PATH,
  ADMIN_ORDER_STATUS_TICKET_PATH,
} from "./orderStatusContracts.js";
import { createOrderStatusStreamSession } from "./createOrderStatusStreamSession.js";
import { requestOrderStatusChange } from "./requestOrderStatusChange.js";

const adminOrderStatusSession = createOrderStatusStreamSession({
  ticketPath: ADMIN_ORDER_STATUS_TICKET_PATH,
  streamPath: ADMIN_ORDER_STATUS_STREAM_PATH,
  logName: "startAdminOrderStatusStream",
});

/**
 * Opens this tab's admin order-status stream. A second call while it is open does nothing.
 *
 * @param {{ apiBaseUrl: string, authToken: string }} startInput - Mock API base and the admin bearer token.
 * @returns {Promise<void>}
 * @sideEffects Opens one EventSource for this tab.
 */
function startAdminOrderStatusStream(startInput) {
  return adminOrderStatusSession.start(startInput);
}

/**
 * Closes this tab's admin order-status stream.
 *
 * @returns {void}
 * @sideEffects Closes the EventSource.
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
 * @param {{ apiBaseUrl: string, authToken: string, orderId: string, status: string }} changeInput - API base, admin bearer token, order id, and the next status.
 * @returns {Promise<{ ok: true, order: object } | { ok: false, code: string }>} Updated order, or a rejection code.
 * @sideEffects PUTs the requested status, claiming the admin actor. The server requires the caller
 *   to hold the admin role for this claim to be granted.
 */
function requestAdminOrderStatusChange(changeInput) {
  return requestOrderStatusChange({ ...changeInput, actor: "admin" });
}

export {
  startAdminOrderStatusStream,
  stopAdminOrderStatusStream,
  subscribeToAdminOrderStatusChanged,
  requestAdminOrderStatusChange,
};
