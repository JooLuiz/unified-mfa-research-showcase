/**
 * Customer order-status client for one ecommerce tab.
 * Role: Opens the signed-in customer's orders.status-changed stream and sends a cancellation request.
 * Not in this file: Admin actions (src/adminOrderStatusClient.js) or rendering.
 * Key dependencies: src/createOrderStatusStreamSession.js; src/requestOrderStatusChange.js.
 * See also: apps/ecommerce-shell/src/main.js; apps/order-details/src/useOrderDetails.js.
 */

import {
  CUSTOMER_ORDER_STATUS_STREAM_PATH,
  CUSTOMER_ORDER_STATUS_TICKET_PATH,
} from "./orderStatusContracts.js";
import { createOrderStatusStreamSession } from "./createOrderStatusStreamSession.js";
import { requestOrderStatusChange } from "./requestOrderStatusChange.js";

const customerOrderStatusSession = createOrderStatusStreamSession({
  ticketPath: CUSTOMER_ORDER_STATUS_TICKET_PATH,
  streamPath: CUSTOMER_ORDER_STATUS_STREAM_PATH,
  logName: "startCustomerOrderStatusStream",
});

/**
 * Opens this tab's customer order-status stream. A second call while it is open does nothing.
 *
 * @param {{ apiBaseUrl: string, authToken: string }} startInput - Mock API base and the shopper's bearer token.
 * @returns {Promise<void>}
 * @sideEffects Opens one EventSource for this tab.
 */
function startCustomerOrderStatusStream(startInput) {
  return customerOrderStatusSession.start(startInput);
}

/**
 * Closes this tab's customer order-status stream.
 *
 * @returns {void}
 * @sideEffects Closes the EventSource.
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
 * @param {{ apiBaseUrl: string, authToken: string, orderId: string }} requestInput - API base, bearer token, and order id.
 * @returns {Promise<{ ok: true, order: object } | { ok: false, code: string }>} Updated order, or a rejection code.
 * @sideEffects PUTs status cancellation-requested.
 */
function requestOrderCancellation({ apiBaseUrl, authToken, orderId }) {
  return requestOrderStatusChange({
    apiBaseUrl,
    authToken,
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
