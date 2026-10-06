/**
 * Manages the admin shell's live-notifications SSE connection lifecycle.
 * Role: Exchanges the admin's Bearer token for a one-time connection ticket, opens/closes the
 *   SSE stream, and exposes a subscribe API for pages to react to live order/post events.
 * Not in this file: Raw EventSource wiring (src/events/adminLiveEventsTransport.js) or
 *   toast/page rendering decisions (consumers call subscribeToAdminLiveEvents themselves).
 * Key dependencies: src/events/adminLiveEventsTransport.js; src/utils/authActions.js;
 *   src/utils/fetchJson.js.
 * See also: src/main.js (start/stop on bootstrap, login, logout).
 */

import fetchJson from "../utils/fetchJson";
import { MOCK_API_BASE_URL } from "../utils/constants";
import { isAdminAuthenticated } from "../utils/authActions";
import { connectAdminEventSource } from "./adminLiveEventsTransport";
import { ADMIN_LIVE_EVENT_NAME } from "./adminLiveEventsContracts";

const INITIAL_RECONNECT_DELAY_MS = 2000;
const MAX_RECONNECT_DELAY_MS = 30_000;

let activeEventSource = null;
let reconnectTimeoutId = null;
let reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
let isStartInFlight = false;

function clearReconnectTimer() {
  if (reconnectTimeoutId) {
    window.clearTimeout(reconnectTimeoutId);
    reconnectTimeoutId = null;
  }
}

function closeActiveEventSource() {
  if (activeEventSource) {
    activeEventSource.close();
    activeEventSource = null;
  }
}

/**
 * Exchanges the admin's Bearer token for a one-time SSE connection ticket.
 *
 * @param {object} appState - Shell state holding the authenticated admin session.
 * @returns {Promise<string>} Ticket to pass to the SSE connection.
 */
async function requestConnectionTicket(appState) {
  const { ticket } = await fetchJson(`${MOCK_API_BASE_URL}/admin/connection-tickets`, {
    method: "POST",
    headers: { Authorization: `Bearer ${appState.authToken}` },
  });
  return ticket;
}

/**
 * Schedules a reconnect attempt with exponential backoff.
 *
 * @param {object} appState - Shell state holding the authenticated admin session.
 * @returns {void}
 * @sideEffects Registers a timeout that re-invokes startAdminLiveEvents.
 */
function scheduleReconnect(appState) {
  clearReconnectTimer();
  reconnectTimeoutId = window.setTimeout(() => {
    reconnectDelayMs = Math.min(reconnectDelayMs * 2, MAX_RECONNECT_DELAY_MS);
    startAdminLiveEvents(appState);
  }, reconnectDelayMs);
}

/**
 * Starts the admin live-notifications SSE connection, if not already connected.
 *
 * @param {object} appState - Shell state holding the authenticated admin session.
 * @returns {Promise<void>}
 * @sideEffects Issues a connection ticket request and opens an EventSource.
 */
async function startAdminLiveEvents(appState) {
  if (!isAdminAuthenticated(appState) || activeEventSource || isStartInFlight) {
    return;
  }

  isStartInFlight = true;
  try {
    const ticket = await requestConnectionTicket(appState);
    activeEventSource = connectAdminEventSource(ticket);
    reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;

    activeEventSource.onerror = () => {
      closeActiveEventSource();
      scheduleReconnect(appState);
    };
  } catch (error) {
    console.warn("startAdminLiveEvents - error");
    console.warn(error);
    scheduleReconnect(appState);
  } finally {
    isStartInFlight = false;
  }
}

/**
 * Stops the admin live-notifications SSE connection and cancels any pending reconnect.
 *
 * @returns {void}
 * @sideEffects Closes the active EventSource and clears the reconnect timer.
 */
function stopAdminLiveEvents() {
  clearReconnectTimer();
  reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
  closeActiveEventSource();
}

/**
 * Subscribes to live admin events (order_created, post_created) fanned out from the SSE stream.
 *
 * @param {(event: { type: string, data: object }) => void} listener - Called with each live event.
 * @returns {() => void} Unsubscribe function.
 * @sideEffects Registers a window event listener.
 */
function subscribeToAdminLiveEvents(listener) {
  function handleAdminLiveEvent(domEvent) {
    listener(domEvent.detail);
  }

  window.addEventListener(ADMIN_LIVE_EVENT_NAME, handleAdminLiveEvent);
  return function unsubscribeFromAdminLiveEvents() {
    window.removeEventListener(ADMIN_LIVE_EVENT_NAME, handleAdminLiveEvent);
  };
}

export { startAdminLiveEvents, stopAdminLiveEvents, subscribeToAdminLiveEvents };
