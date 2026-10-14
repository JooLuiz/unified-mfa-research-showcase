/**
 * Singleton tab client for session event streaming.
 * Role: Provides start, stop, local sign-out suppression, and subscribe helpers for the tab's session SSE connection.
 * Not in this file: Stream internals or the sign-out HTTP request.
 * Key dependencies: src/createSessionStreamSession.js.
 * See also: src/sessionRevocationCommands.js.
 */

import { createSessionStreamSession } from "./createSessionStreamSession.js";

const sessionStreamSession = createSessionStreamSession();

/**
 * Starts the tab's session stream with the given credentials.
 *
 * @param {{ apiBaseUrl: string, authToken: string }} input - API base URL and token.
 * @returns {void}
 * @sideEffects Opens the tab's EventSource when none is open.
 */
function startSessionStream(input) {
  sessionStreamSession.start(input);
}

/**
 * Stops the tab's session stream.
 *
 * @returns {void}
 * @sideEffects Closes the EventSource. Does not clear local sign-out suppression.
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
