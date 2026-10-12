/**
 * One EventSource per tab for order status changes.
 * Role: Exchanges a bearer token for a ticket, opens a single stream, reconnects with backoff,
 *   and fans events out to listeners that may have registered before the socket opened.
 * Not in this file: Which ticket URL to use (the customer and admin clients pass that in) or
 *   the status write (src/requestOrderStatusChange.js).
 * Key dependencies: fetch; EventSource; src/orderStatusContracts.js.
 * See also: src/customerOrderStatusClient.js; src/adminOrderStatusClient.js.
 */

import { ORDER_STATUS_CHANGED_EVENT_NAME } from "./orderStatusContracts.js";

const INITIAL_RECONNECT_DELAY_MS = 2000;
const MAX_RECONNECT_DELAY_MS = 30_000;

/**
 * Creates a tab-scoped order-status stream. Call start once per signed-in session.
 *
 * @param {{ ticketPath: string, streamPath: string, logName: string }} sessionInput - Ticket and stream paths under the API base, plus the name used in reconnect logs.
 * @returns {{ start: (input: { apiBaseUrl: string, authToken: string }) => Promise<void>, stop: () => void, subscribe: (listener: (event: { orderId: string, status: string }) => void) => () => void }} Stream controls.
 */
function createOrderStatusStreamSession({ ticketPath, streamPath, logName }) {
  /** @type {Set<(event: { orderId: string, status: string }) => void>} */
  const listeners = new Set();
  let activeEventSource = null;
  let reconnectTimeoutId = null;
  let reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
  let isStartInFlight = false;
  let activeApiBaseUrl = "";
  let activeAuthToken = "";

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

  function dispatchStatusChanged(messageEvent) {
    const statusEvent = JSON.parse(messageEvent.data);
    listeners.forEach((listener) => listener(statusEvent));
  }

  function scheduleReconnect() {
    clearReconnectTimer();
    reconnectTimeoutId = window.setTimeout(() => {
      if (!activeAuthToken) {
        return;
      }
      reconnectDelayMs = Math.min(reconnectDelayMs * 2, MAX_RECONNECT_DELAY_MS);
      void start({ apiBaseUrl: activeApiBaseUrl, authToken: activeAuthToken });
    }, reconnectDelayMs);
  }

  /**
   * Opens the tab's single order-status stream when a token is present and none is open.
   *
   * @param {{ apiBaseUrl: string, authToken: string }} startInput - Mock API base and bearer token.
   * @returns {Promise<void>}
   * @sideEffects Requests a ticket and opens one EventSource. On error, retries with a new ticket.
   */
  async function start({ apiBaseUrl, authToken }) {
    activeApiBaseUrl = apiBaseUrl;
    activeAuthToken = authToken;
    if (!authToken || activeEventSource || isStartInFlight) {
      return;
    }

    isStartInFlight = true;
    try {
      const ticketResponse = await fetch(`${apiBaseUrl}${ticketPath}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!ticketResponse.ok) {
        throw new Error(`${logName} - ticket request failed: ${ticketResponse.status}`);
      }
      const ticketBody = await ticketResponse.json();
      if (activeAuthToken !== authToken) {
        return;
      }
      const eventSource = new EventSource(
        `${apiBaseUrl}${streamPath}?ticket=${encodeURIComponent(ticketBody.ticket)}`,
      );
      eventSource.addEventListener(ORDER_STATUS_CHANGED_EVENT_NAME, dispatchStatusChanged);
      eventSource.onerror = () => {
        closeActiveEventSource();
        scheduleReconnect();
      };
      activeEventSource = eventSource;
      reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
    } catch (error) {
      console.warn(`${logName} - error`);
      console.warn(error);
      scheduleReconnect();
    } finally {
      isStartInFlight = false;
    }
  }

  /**
   * Closes the stream and cancels any pending reconnect.
   *
   * @returns {void}
   * @sideEffects Closes the EventSource.
   */
  function stop() {
    activeAuthToken = "";
    clearReconnectTimer();
    reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
    closeActiveEventSource();
  }

  /**
   * Registers a listener for orders.status-changed. Safe to call before start.
   *
   * @param {(event: { orderId: string, status: string }) => void} listener - Called with each pushed status.
   * @returns {() => void} Unsubscribe function.
   * @sideEffects Adds the listener to this tab's set.
   */
  function subscribe(listener) {
    listeners.add(listener);
    return function unsubscribe() {
      listeners.delete(listener);
    };
  }

  return { start, stop, subscribe };
}

export { createOrderStatusStreamSession };
