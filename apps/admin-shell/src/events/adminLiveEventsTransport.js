/**
 * Owns the raw Server-Sent Events connection for admin live notifications.
 * Role: Opens an EventSource against the mock data service's admin stream and re-dispatches
 *   each named SSE event as a window CustomEvent for shell-local consumption.
 * Not in this file: Ticket exchange, reconnect policy, or auth-session lifecycle
 *   (src/events/adminLiveEvents.js).
 * Key dependencies: src/events/adminLiveEventsContracts.js; src/utils/constants.js.
 * See also: apps/mock-data-service/src/routes/adminRoutes.js (GET /admin/events).
 */

import { MOCK_API_BASE_URL } from "../utils/constants";
import {
  ADMIN_LIVE_EVENT_NAME,
  ORDER_CREATED_EVENT_TYPE,
  POST_CREATED_EVENT_TYPE,
} from "./adminLiveEventsContracts";

/**
 * Re-dispatches a parsed SSE payload as a window CustomEvent for shell-local subscribers.
 *
 * @param {string} eventType - SSE event name (e.g. "order_created").
 * @param {MessageEvent} messageEvent - Raw SSE message event.
 * @returns {void}
 * @sideEffects Dispatches a window CustomEvent.
 */
function dispatchAdminLiveEvent(eventType, messageEvent) {
  const data = JSON.parse(messageEvent.data);
  window.dispatchEvent(
    new CustomEvent(ADMIN_LIVE_EVENT_NAME, {
      detail: { type: eventType, data },
    }),
  );
}

/**
 * Opens an authenticated SSE connection to the admin live-notifications stream.
 *
 * @param {string} ticket - One-time connection ticket from POST /admin/connection-tickets.
 * @returns {EventSource} The open connection; callers own closing it.
 * @sideEffects Opens a network connection and registers SSE listeners.
 */
function connectAdminEventSource(ticket) {
  const eventSource = new EventSource(
    `${MOCK_API_BASE_URL}/admin/events?ticket=${encodeURIComponent(ticket)}`,
  );

  eventSource.addEventListener(ORDER_CREATED_EVENT_TYPE, (messageEvent) =>
    dispatchAdminLiveEvent(ORDER_CREATED_EVENT_TYPE, messageEvent),
  );
  eventSource.addEventListener(POST_CREATED_EVENT_TYPE, (messageEvent) =>
    dispatchAdminLiveEvent(POST_CREATED_EVENT_TYPE, messageEvent),
  );

  return eventSource;
}

export { connectAdminEventSource };
