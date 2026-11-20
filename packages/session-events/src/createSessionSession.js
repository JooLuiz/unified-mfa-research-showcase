/**
 * One session subscription per tab.
 * Role: Starts and stops the session/revoked subscription and suppresses the tab that is signing itself out.
 * Not in this file: The sign-out HTTP command (src/sessionRevocationCommands.js).
 * Key dependencies: src/sessionEventsContracts.js. The caller supplies the transport.
 * See also: src/sessionEventsClient.js.
 */

import { SESSION_REVOKED_EVENT, SESSION_TOPIC } from "./sessionEventsContracts.js";

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
   * @sideEffects Subscribes to session/revoked and clears a previous local sign-out suppression.
   */
  function start(transport) {
    if (unsubscribeFromTransport) {
      return;
    }
    ignoreIncomingRevocation = false;
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
