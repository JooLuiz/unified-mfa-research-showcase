/**
 * One mesh subscription per tab for session events (such as session.revoked).
 * Role: Manages a tab-scoped session/revoked subscription on the local Event Mesh client,
 *   delivering matching revocations to registered listeners.
 * Not in this file: UI toasts, shell navigation, or the sign-out-everywhere HTTP write
 *   (src/sessionRevocationCommands.js).
 * Key dependencies: event-mesh/mesh; src/createSessionEvents.js; src/sessionEventsContracts.js.
 * See also: src/sessionEventsClient.js.
 *   On main this module opens a Server-Sent Events connection; this branch subscribes through
 *   the gateway. The server broadcasts session/revoked to every open socket; this module drops
 *   events whose userId is not the one passed to start.
 */

import mesh from "event-mesh/mesh";
import { createSessionEvents } from "./createSessionEvents.js";
import { SESSION_TOPIC, SESSION_REVOKED_EVENT } from "./sessionEventsContracts.js";

/**
 * Creates a tab-scoped session stream session backed by the local mesh client.
 *
 * @returns {{
 *   start: (input: { authToken?: string, userId?: string }) => void,
 *   stop: () => void,
 *   subscribe: (listener: () => void) => () => void
 * }} Stream controls.
 */
function createSessionStreamSession() {
  /** @type {Set<(message: { payload?: object }) => void>} */
  const inboundCallbacks = new Set();
  const sessionEvents = createSessionEvents({
    subscribe(_topic, _event, callback) {
      inboundCallbacks.add(callback);
      return function unsubscribeFromSessionRevoked() {
        inboundCallbacks.delete(callback);
      };
    },
  });

  let unsubscribeFromMeshRevocation = null;
  let watchedUserId = null;

  /**
   * Calls every registered listener once for a pushed session/revoked that matches this tab.
   *
   * @returns {void}
   */
  function notifyListeners() {
    inboundCallbacks.forEach((callback) => {
      try {
        callback({ payload: {} });
      } catch (error) {
        console.warn("createSessionStreamSession - listener error");
        console.warn(error);
      }
    });
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
  function start(startInput) {
    if (!startInput?.authToken || !startInput.userId || unsubscribeFromMeshRevocation) {
      return;
    }

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
  function stop() {
    watchedUserId = null;

    if (unsubscribeFromMeshRevocation) {
      unsubscribeFromMeshRevocation();
      unsubscribeFromMeshRevocation = null;
    }
  }

  /**
   * Subscribes a listener to session.revoked notifications that match this tab's user.
   *
   * Safe to call at any time, including before the mesh session starts: this only adds
   * to an in-memory registry and never touches the mesh client directly, so it cannot
   * trigger EventMesh's lazy singleton ahead of configureMesh().
   *
   * @param {() => void} listener - Called once per matching session/revoked push.
   * @returns {() => void} Removes this listener from the registry.
   * @sideEffects Registers the listener on createSessionEvents. Mesh subscribe stays in start.
   */
  function subscribe(listener) {
    return sessionEvents.subscribeToSessionRevoked(listener);
  }

  return { start, stop, subscribe };
}

export { createSessionStreamSession };
