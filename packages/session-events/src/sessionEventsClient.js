/**
 * Singleton tab client for session event streaming.
 * Role: Provides start, stop, and subscribe helpers for the tab's session SSE connection.
 * Not in this file: Stream internals or HTTP request logic.
 * Key dependencies: src/createSessionStreamSession.js.
 * See also: src/sessionRevocationCommands.js.
 */

import { createSessionStreamSession } from "./createSessionStreamSession.js";

const sessionStreamSession = createSessionStreamSession();

/**
 * Starts the tab's session stream with the given credentials.
 *
 * @param {{ apiBaseUrl: string, authToken: string }} input - API base URL and token.
 */
function startSessionStream(input) {
  sessionStreamSession.start(input);
}

/**
 * Stops the tab's session stream.
 */
function stopSessionStream() {
  sessionStreamSession.stop();
}

/**
 * Subscribes a listener to session.revoked notifications.
 *
 * @param {() => void} listener - Callback to trigger when a revocation arrives.
 * @returns {() => void} Unsubscribe function.
 */
function subscribeToSessionRevoked(listener) {
  return sessionStreamSession.subscribe(listener);
}

export {
  startSessionStream,
  stopSessionStream,
  subscribeToSessionRevoked,
};
