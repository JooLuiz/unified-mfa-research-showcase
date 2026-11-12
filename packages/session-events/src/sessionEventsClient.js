/**
 * Singleton tab client for session event streaming over the Event Mesh gateway.
 * Role: Provides start, stop, and subscribe helpers for the tab's session/revoked mesh
 *   subscription, without exposing mesh timing constraints to callers.
 * Not in this file: Stream internals or the sign-out HTTP request.
 * Key dependencies: src/createSessionSession.js.
 * See also: src/sessionRevocationCommands.js.
 */

import { createSessionStreamSession } from "./createSessionSession.js";

const sessionStreamSession = createSessionStreamSession();

/**
 * Starts the tab's session/revoked mesh subscription for the signed-in user.
 *
 * @param {{ authToken?: string, userId?: string }} [input] - `authToken` gates the start; `userId` filters revokes.
 * @returns {void}
 * @sideEffects Subscribes to session/revoked on the local mesh client when none is open.
 */
function startSessionLiveEvents(input) {
  sessionStreamSession.start(input);
}

/**
 * Stops the tab's session/revoked mesh subscription.
 *
 * @returns {void}
 * @sideEffects Removes the mesh subscription without closing the mesh client.
 */
function stopSessionLiveEvents() {
  sessionStreamSession.stop();
}

/**
 * Subscribes a listener to session.revoked notifications that match this tab's user.
 *
 * @param {() => void} listener - Callback to trigger when a matching revocation arrives.
 * @returns {() => void} Unsubscribe function.
 * @sideEffects Registers the listener on this tab's session.
 */
function subscribeToSessionRevoked(listener) {
  return sessionStreamSession.subscribe(listener);
}

export { startSessionLiveEvents, stopSessionLiveEvents, subscribeToSessionRevoked };
