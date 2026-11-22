/**
 * One session subscription per tab.
 * Role: Starts and stops the session/revoked subscription, announces session/watching, and suppresses the tab that is signing itself out.
 * Not in this file: The sign-out HTTP command (src/sessionRevocationCommands.js).
 * Key dependencies: src/sessionEventsContracts.js. The caller supplies the transport.
 * See also: src/sessionEventsClient.js.
 */

import {
  SESSION_REVOKED_EVENT,
  SESSION_TOPIC,
  SESSION_WATCHING_EVENT,
} from "./sessionEventsContracts.js";

const MESH_CONNECT_TIMEOUT_MS = 5000;

/**
 * Registers this tab for session-revocation catch-up once the socket is open.
 *
 * @param {{ publish?: Function, whenConnected?: Function }} transport - Event interface. A subscribe-only fake is ignored.
 * @returns {void}
 * @sideEffects Publishes session/watching. A connect timeout is swallowed.
 */
function publishSessionWatching(transport) {
  if (!openTransport(transport)) {
    return;
  }
  transport.publish({
    topic: SESSION_TOPIC,
    event: SESSION_WATCHING_EVENT,
    payload: {},
    scope: "distributed",
  });
}

/**
 * Starts the socket for a transport that can publish. A subscribe-only fake is skipped.
 *
 * @param {{ publish?: Function, whenConnected?: Function }} transport - Event interface.
 * @returns {boolean} True when the caller should publish.
 * @sideEffects Calls whenConnected. A closed client or a connect timeout does not throw.
 */
function openTransport(transport) {
  if (typeof transport.publish !== "function" || typeof transport.whenConnected !== "function") {
    return false;
  }
  try {
    const connected = transport.whenConnected({ timeoutMs: MESH_CONNECT_TIMEOUT_MS });
    if (connected && typeof connected.catch === "function") {
      connected.catch(() => {
        // A missed announce skips revocation catch-up for this connection.
      });
    }
  } catch {
    return false;
  }
  return true;
}

/**
 * Creates a tab-scoped session subscription.
 *
 * @returns {{ start: (transport: { subscribe: Function }) => void, stop: () => void, markLocalSignOut: () => void, subscribe: (listener: () => void) => () => void }} Session controls.
 */
function createSessionStreamSession() {
  /** @type {Set<() => void>} */
  const listeners = new Set();
  let unsubscribeFromTransport = null;
  let ignoreIncomingRevocation = false;

  /**
   * Opens the session subscription when a previous one is not already open.
   *
   * @param {{ subscribe: Function }} transport - Event interface.
   * @returns {void}
   * @sideEffects Subscribes to session/revoked, publishes session/watching, and clears a previous local sign-out suppression.
   */
  function start(transport) {
    if (unsubscribeFromTransport) {
      return;
    }
    ignoreIncomingRevocation = false;
    publishSessionWatching(transport);
    unsubscribeFromTransport = transport.subscribe(SESSION_TOPIC, SESSION_REVOKED_EVENT, () => {
      if (ignoreIncomingRevocation) {
        return;
      }
      listeners.forEach((listener) => listener());
    });
  }

  /**
   * Closes the subscription. Does not clear a local sign-out suppression.
   *
   * @returns {void}
   * @sideEffects Unsubscribes from the transport.
   */
  function stop() {
    if (unsubscribeFromTransport) {
      unsubscribeFromTransport();
      unsubscribeFromTransport = null;
    }
  }

  /**
   * Ignores session.revoked on this tab until the next start.
   *
   * @returns {void}
   * @sideEffects Suppresses listener delivery for the current subscription.
   */
  function markLocalSignOut() {
    ignoreIncomingRevocation = true;
  }

  /**
   * Subscribes a listener to session.revoked.
   *
   * @param {() => void} listener - Called when a revocation arrives from another tab.
   * @returns {() => void} Unsubscribe function.
   * @sideEffects Registers the listener.
   */
  function subscribe(listener) {
    listeners.add(listener);
    return function unsubscribeFromSessionRevoked() {
      listeners.delete(listener);
    };
  }

  return { start, stop, markLocalSignOut, subscribe };
}

export { createSessionStreamSession };
