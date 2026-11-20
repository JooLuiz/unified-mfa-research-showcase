/**
 * Singleton tab client for session event streaming.
 * Role: Provides start, stop, local sign-out suppression, and subscribe helpers for the tab's session subscription.
 * Not in this file: Stream URL selection or the sign-out command.
 * Key dependencies: src/createSessionSession.js.
 * See also: src/sessionRevocationCommands.js.
 */

import { createSessionStreamSession } from "./createSessionSession.js";

const sessionStreamSession = createSessionStreamSession();

/**
 * Starts the tab's session stream.
 *
 * @param {{ subscribe: Function }} transport - Event interface.
 * @returns {void}
 * @sideEffects Opens the tab's session subscription when none is open.
 */
function startSessionStream(transport) {
  sessionStreamSession.start(transport);
}

/**
 * Stops the tab's session stream.
 *
 * @returns {void}
 * @sideEffects Closes the subscription. Does not clear local sign-out suppression.
 */
function stopSessionStream() {
  sessionStreamSession.stop();
}

/**
 * Ignores session.revoked on this tab until the next stream start.
 * Used by the tab that is about to call sign-out-everywhere, so its own broadcast does not toast.
 *
 * @returns {void}
 * @sideEffects Suppresses listener delivery and reconnect for the current stream.
 */
function markLocalSignOut() {
  sessionStreamSession.markLocalSignOut();
}

/**
 * Subscribes a listener to session.revoked notifications.
 *
 * @param {() => void} listener - Callback to trigger when a revocation arrives from another tab.
 * @returns {() => void} Unsubscribe function.
 * @sideEffects Registers the listener on this tab's session.
 */
function subscribeToSessionRevoked(listener) {
  return sessionStreamSession.subscribe(listener);
}

export {
  startSessionStream,
  stopSessionStream,
  markLocalSignOut,
  subscribeToSessionRevoked,
};
