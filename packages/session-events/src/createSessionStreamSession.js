/**
 * One EventSource per tab for session events (such as session.revoked).
 * Role: Manages a tab-scoped SSE connection to /auth/session-stream with reconnect logic,
 *   delivering events to registered listeners.
 * Not in this file: UI toasts or shell navigation.
 * Key dependencies: EventSource; src/sessionEventsContracts.js.
 * See also: src/sessionEventsClient.js.
 */

import {
  SESSION_REVOKED_EVENT_NAME,
  SESSION_STREAM_PATH,
} from "./sessionEventsContracts.js";

const INITIAL_RECONNECT_DELAY_MS = 2000;
const MAX_RECONNECT_DELAY_MS = 30_000;

/**
 * Creates a tab-scoped session stream session.
 *
 * @returns {{
 *   start: (input: { apiBaseUrl: string, authToken: string }) => void,
 *   stop: () => void,
 *   subscribe: (listener: () => void) => () => void
 * }} Stream controls.
 */
function createSessionStreamSession() {
  /** @type {Set<() => void>} */
  const listeners = new Set();
  let activeEventSource = null;
  let reconnectTimeoutId = null;
  let reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
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

  function dispatchSessionRevoked() {
    listeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        console.warn("createSessionStreamSession - listener error");
        console.warn(error);
      }
    });
  }

  function scheduleReconnect() {
    clearReconnectTimer();
    reconnectTimeoutId = window.setTimeout(() => {
      if (!activeAuthToken) {
        return;
      }
      reconnectDelayMs = Math.min(reconnectDelayMs * 2, MAX_RECONNECT_DELAY_MS);
      start({ apiBaseUrl: activeApiBaseUrl, authToken: activeAuthToken });
    }, reconnectDelayMs);
  }

  /**
   * Opens the tab's single session stream when an authToken is present and none is currently open.
   *
   * @param {{ apiBaseUrl: string, authToken: string }} startInput - API base URL and bearer token.
   * @returns {void}
   */
  function start({ apiBaseUrl, authToken }) {
    activeApiBaseUrl = apiBaseUrl;
    activeAuthToken = authToken;

    if (!authToken || activeEventSource) {
      return;
    }

    try {
      const streamUrl = `${apiBaseUrl}${SESSION_STREAM_PATH}?token=${encodeURIComponent(authToken)}`;
      const eventSource = new EventSource(streamUrl);

      eventSource.addEventListener(SESSION_REVOKED_EVENT_NAME, () => {
        dispatchSessionRevoked();
        closeActiveEventSource();
      });

      eventSource.onerror = () => {
        closeActiveEventSource();
        scheduleReconnect();
      };

      activeEventSource = eventSource;
      reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
    } catch (error) {
      console.warn("createSessionStreamSession - start error");
      console.warn(error);
      scheduleReconnect();
    }
  }

  /**
   * Closes the open session stream and clears pending reconnect timers.
   *
   * @returns {void}
   */
  function stop() {
    activeAuthToken = "";
    clearReconnectTimer();
    reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
    closeActiveEventSource();
  }

  /**
   * Subscribes a listener to the session.revoked event.
   *
   * @param {() => void} listener - Callback invoked when the user session is revoked.
   * @returns {() => void} Unsubscribe function.
   */
  function subscribe(listener) {
    listeners.add(listener);
    return function unsubscribe() {
      listeners.delete(listener);
    };
  }

  return { start, stop, subscribe };
}

export { createSessionStreamSession };
