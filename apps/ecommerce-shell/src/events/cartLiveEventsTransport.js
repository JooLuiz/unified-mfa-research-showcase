/**
 * Owns the raw Server-Sent Events connection for the signed-in cart.
 * Role: Opens an EventSource against GET /api/cart/events and re-dispatches cart_changed.
 * Not in this file: Ticket exchange or reconnect policy (src/events/cartLiveEvents.js).
 * Key dependencies: src/events/cartLiveEventsContracts.js; src/utils/constants.js.
 * See also: apps/mock-data-service/src/routes/cartRoutes.js.
 */

import { MOCK_API_BASE_URL } from "../utils/constants";
import { CART_CHANGED_EVENT_TYPE, CART_LIVE_EVENT_NAME } from "./cartLiveEventsContracts";

/**
 * Re-dispatches a pushed cart as a window event for this tab.
 *
 * @param {MessageEvent} messageEvent - Raw SSE message event.
 * @returns {void}
 * @sideEffects Dispatches a window CustomEvent whose detail is the cart payload.
 */
function dispatchCartLiveEvent(messageEvent) {
  const cart = JSON.parse(messageEvent.data);
  window.dispatchEvent(
    new CustomEvent(CART_LIVE_EVENT_NAME, {
      detail: cart,
    }),
  );
}

/**
 * Opens an authenticated SSE connection to the cart stream.
 *
 * @param {string} ticket - One-time connection ticket from POST /api/cart/connection-tickets.
 * @returns {EventSource} The open connection; callers own closing it.
 * @sideEffects Opens a network connection and registers the cart_changed listener.
 */
function connectCartEventSource(ticket) {
  const eventSource = new EventSource(
    `${MOCK_API_BASE_URL}/cart/events?ticket=${encodeURIComponent(ticket)}`,
  );
  eventSource.addEventListener(CART_CHANGED_EVENT_TYPE, dispatchCartLiveEvent);
  return eventSource;
}

export { connectCartEventSource };
