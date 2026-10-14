/**
 * Manages this tab's session-revocation mesh subscription.
 * Role: Subscribes to session/revoked and fans matching events out to local listeners,
 *   without exposing mesh timing constraints to callers.
 * Not in this file: The sign-out-everywhere HTTP write (src/sessionRevocationCommands.js) or
 *   the toast and logout orchestration, which is each shell's main.js.
 * Key dependencies: event-mesh/mesh; src/sessionEventsContracts.js.
 * See also: apps/admin-shell/src/main.js; apps/ecommerce-shell/src/main.js;
 *   apps/social-media-shell/src/main.js.
 *   On main this concern is served over Server-Sent Events; this branch subscribes through the
 *   gateway. The server broadcasts session/revoked to every open socket; this module drops
 *   events whose userId is not the one passed to startSessionLiveEvents.
 */

import mesh from "event-mesh/mesh";
import { SESSION_TOPIC, SESSION_REVOKED_EVENT } from "./sessionEventsContracts.js";

let liveEventsGeneration = 0;
let unsubscribeFromMeshRevocation = null;
let watchedUserId = null;

/** @type {Set<() => void>} */
const listeners = new Set();

/**
 * Calls every registered listener once for a pushed session/revoked that matches this tab.
 *
 * @returns {void}
 */
function notifyListeners() {
  listeners.forEach((listener) => listener());
}

/**
 * Starts the mesh subscription for this tab's signed-in user.
 *
 * Subscribes immediately. Waiting for the socket first drops a revoke that arrives in the
 * gap, and a whenConnected timeout used to leave the tab unsubscribed for the rest of the
 * session.
 *
 * @param {{ authToken?: string, userId?: string }} [startInput] - `authToken` gates the start.
 *   `userId` is the signed-in user; revokes for any other user are ignored.
 * @returns {void}
 * @sideEffects Subscribes to session/revoked on the local mesh client.
 */
function startSessionLiveEvents(startInput) {
  if (!startInput?.authToken || !startInput.userId || unsubscribeFromMeshRevocation) {
    return;
  }

  liveEventsGeneration += 1;
  watchedUserId = startInput.userId;
  unsubscribeFromMeshRevocation = mesh.subscribe(
    SESSION_TOPIC,
    SESSION_REVOKED_EVENT,
    (message) => {
      if (message.payload?.userId !== watchedUserId) {
        return;
      }
      notifyListeners();
    },
  );
}

/**
 * Stops the mesh subscription without closing the mesh client.
 *
 * Calling this just before POSTing sign-out-everywhere removes this tab's own session/revoked
 * handler synchronously, so the server's broadcast arrives with nothing registered to receive
 * it — the clicking tab never sees its own "ended on another device" notice.
 *
 * @returns {void}
 * @sideEffects Removes the mesh subscription and forgets the watched user id.
 */
function stopSessionLiveEvents() {
  liveEventsGeneration += 1;
  watchedUserId = null;

  if (unsubscribeFromMeshRevocation) {
    unsubscribeFromMeshRevocation();
    unsubscribeFromMeshRevocation = null;
  }
}

/**
 * Registers a local listener for session/revoked pushes that match this tab's user.
 *
 * Safe to call at any time, including before the mesh session starts: this only adds
 * to an in-memory registry and never touches the mesh client directly, so it cannot
 * trigger EventMesh's lazy singleton ahead of configureMesh().
 *
 * @param {() => void} listener - Called once per matching session/revoked push.
 * @returns {() => void} Removes this listener from the registry.
 * @sideEffects Mutates the module-local listener registry.
 */
function subscribeToSessionRevoked(listener) {
  listeners.add(listener);
  return function unsubscribeFromSessionRevoked() {
    listeners.delete(listener);
  };
}

export { startSessionLiveEvents, stopSessionLiveEvents, subscribeToSessionRevoked };
