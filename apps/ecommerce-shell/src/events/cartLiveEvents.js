/**
 * Manages the ecommerce shell's live cart SSE connection.
 * Role: Exchanges the bearer token for a one-time ticket, then opens, closes, and reconnects the stream.
 * Not in this file: Applying the cart (src/utils/cartSync.js) or the raw EventSource
 *   (src/events/cartLiveEventsTransport.js).
 * Key dependencies: src/events/cartLiveEventsTransport.js; src/utils/fetchJson.js.
 * See also: src/main.js.
 */

import fetchJson from "../utils/fetchJson";
import { MOCK_API_BASE_URL } from "../utils/constants";
import { CART_LIVE_EVENT_NAME } from "./cartLiveEventsContracts";
import { connectCartEventSource } from "./cartLiveEventsTransport";

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
 * Exchanges the shopper's bearer token for a one-time cart SSE ticket.
 *
 * @param {object} appState - Shell state holding the authenticated session.
 * @returns {Promise<string>} Ticket to pass to the SSE connection.
 */
async function requestConnectionTicket(appState) {
  const { ticket } = await fetchJson(`${MOCK_API_BASE_URL}/cart/connection-tickets`, {
    method: "POST",
    headers: { Authorization: `Bearer ${appState.authToken}` },
  });
  return ticket;
}

/**
 * Schedules a reconnect that asks for a new ticket.
 *
 * @param {object} appState - Shell state holding the authenticated session.
 * @returns {void}
 * @sideEffects Registers a timeout. A missing token cancels the attempt.
 */
function scheduleReconnect(appState) {
  clearReconnectTimer();
  reconnectTimeoutId = window.setTimeout(() => {
    if (!appState.authToken) {
      return;
    }
    reconnectDelayMs = Math.min(reconnectDelayMs * 2, MAX_RECONNECT_DELAY_MS);
    void startCartLiveEvents(appState);
  }, reconnectDelayMs);
}

/**
 * Starts the cart SSE connection when this tab has a token and is not already connected.
 *
 * @param {object} appState - Shell state holding the authenticated session.
 * @returns {Promise<void>}
 * @sideEffects Requests a fresh ticket and opens an EventSource. On error, closes it and retries with a new ticket.
 */
async function startCartLiveEvents(appState) {
  if (!appState.authToken || activeEventSource || isStartInFlight) {
    return;
  }

  isStartInFlight = true;
  try {
    const ticket = await requestConnectionTicket(appState);
    if (!appState.authToken) {
      return;
    }
    activeEventSource = connectCartEventSource(ticket);
    reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
    activeEventSource.onerror = () => {
      closeActiveEventSource();
      scheduleReconnect(appState);
    };
  } catch (error) {
    console.warn("startCartLiveEvents - error");
    console.warn(error);
    scheduleReconnect(appState);
  } finally {
    isStartInFlight = false;
  }
}

/**
 * Stops the cart SSE connection and cancels any pending reconnect.
 *
 * @returns {void}
 * @sideEffects Closes the active EventSource and clears the reconnect timer.
 */
function stopCartLiveEvents() {
  clearReconnectTimer();
  reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
  closeActiveEventSource();
}

/**
 * Subscribes to carts pushed on the live stream.
 *
 * @param {(cart: object) => void} listener - Called with each cart_changed payload.
 * @returns {() => void} Unsubscribe function.
 * @sideEffects Registers a window event listener.
 */
function subscribeToCartLiveEvents(listener) {
  function handleCartLiveEvent(domEvent) {
    listener(domEvent.detail);
  }

  window.addEventListener(CART_LIVE_EVENT_NAME, handleCartLiveEvent);
  return function unsubscribeFromCartLiveEvents() {
    window.removeEventListener(CART_LIVE_EVENT_NAME, handleCartLiveEvent);
  };
}

export { startCartLiveEvents, stopCartLiveEvents, subscribeToCartLiveEvents };
