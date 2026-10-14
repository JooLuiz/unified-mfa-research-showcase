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
 *   markLocalSignOut: () => void,
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
  let ignoreIncomingRevocation = false;

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
    if (ignoreIncomingRevocation) {
      return;
    }
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
   * @sideEffects Opens one EventSource. Clears a previous local sign-out suppression so this session can be revoked remotely.
   */
  function start({ apiBaseUrl, authToken }) {
    activeApiBaseUrl = apiBaseUrl;
    activeAuthToken = authToken;

    if (!authToken || activeEventSource) {
      return;
    }

    ignoreIncomingRevocation = false;

    try {
      const streamUrl = `${apiBaseUrl}${SESSION_STREAM_PATH}?token=${encodeURIComponent(authToken)}`;
      const eventSource = new EventSource(streamUrl);

      eventSource.addEventListener(SESSION_REVOKED_EVENT_NAME, () => {
        dispatchSessionRevoked();
        closeActiveEventSource();
      });

      eventSource.onerror = () => {
        closeActiveEventSource();
        if (ignoreIncomingRevocation) {
          return;
        }
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
   * Does not clear a local sign-out suppression. A session.revoked frame can still arrive after close.
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
   * Ignores the next session.revoked delivery on this tab.
   * The tab that calls sign-out-everywhere still receives the broadcast on its own stream.
   * stop() leaves this flag set so a frame that arrives after the stream closes is still ignored.
   * The next start() clears it.
   *
   * @returns {void}
   * @sideEffects Suppresses listener delivery and reconnect until the next stream start.
   */
  function markLocalSignOut() {
    ignoreIncomingRevocation = true;
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

  return { start, stop, markLocalSignOut, subscribe };
}

export { createSessionStreamSession };
