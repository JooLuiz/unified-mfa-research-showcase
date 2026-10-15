/**
 * Admin order-status client for one admin tab.
 * Role: Exposes the all-orders admin/order_status_changed stream and sends ship, deliver,
 *   cancel, accept, and decline writes.
 * Not in this file: Customer cancellation requests (src/customerOrderStatusClient.js) or table
 *   markup. The admin/watching announce itself lives in apps/admin-shell/src/events/adminLiveEvents.js
 *   and is reused here rather than duplicated.
 * Key dependencies: src/createOrderStatusWatchSession.js; src/requestOrderStatusChange.js.
 * See also: apps/admin-shell/src/main.js; apps/admin-shell/src/pages/ordersPage.js.
 */

import {
  ADMIN_TOPIC,
  ADMIN_ORDER_STATUS_CHANGED_EVENT,
} from "./orderStatusContracts.js";
import { createOrderStatusWatchSession } from "./createOrderStatusWatchSession.js";
import { requestOrderStatusChange } from "./requestOrderStatusChange.js";

const adminOrderStatusSession = createOrderStatusWatchSession({
  topic: ADMIN_TOPIC,
  statusChangedEvent: ADMIN_ORDER_STATUS_CHANGED_EVENT,
  logName: "startAdminOrderStatusStream",
});

/**
 * Opens this tab's admin order-status watch session. A second call while it is open does nothing.
 *
 * @param {{ apiBaseUrl?: string, authToken?: string }} [startInput] - `authToken` gates the
 *   start, matching the HTTP branch's guard; `apiBaseUrl` is accepted and unused. No watching
 *   announce is published here: the admin session is already recorded by admin/watching in
 *   apps/admin-shell/src/events/adminLiveEvents.js.
 * @returns {Promise<void>}
 * @sideEffects Subscribes to admin/order_status_changed.
 */
function startAdminOrderStatusStream(startInput) {
  if (!startInput?.authToken) {
    return Promise.resolve();
  }
  return adminOrderStatusSession.start();
}

/**
 * Closes this tab's admin order-status watch session.
 *
 * @returns {void}
 * @sideEffects Removes the mesh subscription.
 */
function stopAdminOrderStatusStream() {
  adminOrderStatusSession.stop();
}

/**
 * Subscribes to every order's status changes.
 *
 * @param {(event: { orderId: string, status: string }) => void} listener - Called with each pushed status.
 * @returns {() => void} Unsubscribe function.
 * @sideEffects Registers the listener. The session itself is owned by startAdminOrderStatusStream.
 */
function subscribeToAdminOrderStatusChanged(listener) {
  return adminOrderStatusSession.subscribe(listener);
}

/**
 * Asks the server to apply an admin status transition.
 *
 * @param {{ apiBaseUrl?: string, authToken?: string, orderId: string, status: string }} changeInput - Order id and the next status. `apiBaseUrl`/`authToken` are accepted for call-site
 *   compatibility and unused.
 * @returns {Promise<{ ok: true, order: object } | { ok: false, code: string }>} Updated order, or a rejection code.
 * @sideEffects Publishes orders/status-change-requested with the requested status and actor admin.
 *   The server requires the caller to hold the admin role for this claim to be granted.
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
