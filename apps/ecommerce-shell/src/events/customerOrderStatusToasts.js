/**
 * Toasts a signed-in shopper when one of their orders changes off-screen.
 * Role: Listens to the shared customer order-status stream and skips the toast when the
 *   account list or that order's details page is already showing the change.
 * Not in this file: Opening the stream (src/main.js) or patching a visible row.
 * Key dependencies: @shared/order-status-events; src/notifications/notificationAdapter.js.
 * See also: src/main.js; src/pages/accountPage.js.
 */

import {
  formatOrderStatus,
  subscribeToOrderStatusChanged,
} from "@shared/order-status-events";
import { publishNotification } from "../notifications/notificationAdapter";

const ORDER_DETAILS_ROUTE_PREFIX = "/order-details/";

function isViewingOrderDetails(orderId) {
  const pathName = window.location.pathname;
  if (!pathName.startsWith(ORDER_DETAILS_ROUTE_PREFIX)) {
    return false;
  }
  const orderIdSegment = pathName.slice(ORDER_DETAILS_ROUTE_PREFIX.length);
  if (!orderIdSegment || orderIdSegment.includes("/")) {
    return false;
  }
  try {
    return decodeURIComponent(orderIdSegment) === orderId;
  } catch {
    return orderIdSegment === orderId;
  }
}

/**
 * Starts the customer toast listener for this tab.
 *
 * @param {object} appState - Shell state holding the auth token.
 * @returns {void}
 * @sideEffects Subscribes for the life of the tab. A signed-out tab ignores events.
 */
function registerCustomerOrderStatusToasts(appState) {
  subscribeToOrderStatusChanged(({ orderId, status }) => {
    if (!appState.authToken) {
      return;
    }
    if (window.location.pathname === "/account" || isViewingOrderDetails(orderId)) {
      return;
    }
    publishNotification({
      type: "success",
      title: "Order updated",
      message: `Order ${orderId} is now ${formatOrderStatus(status)}.`,
    });
  });
}

export { registerCustomerOrderStatusToasts };
