/**
 * Manages the ecommerce shell's saved-cart mesh subscription.
 * Role: Announces this connection on cart-sync/watching and fans cart-sync/changed out to
 *   any number of local listeners, without exposing mesh timing constraints to callers.
 * Not in this file: Applying the cart (src/utils/cartSync.js) or mesh session open/close
 *   (src/main.js).
 * Key dependencies: event-mesh/mesh; src/events/cartLiveEventsContracts.js.
 * See also: src/main.js; packages/shell-events/src/createShellEvents.js (same ensure/reset shape).
 */

import mesh from "event-mesh/mesh";
import { CART_CHANGED_EVENT_TYPE, CART_SYNC_TOPIC, CART_WATCHING_EVENT } from "./cartLiveEventsContracts";

const WATCHING_ANNOUNCE_INTERVAL_MS = 10_000;
const MESH_CONNECT_TIMEOUT_MS = 5000;

let liveEventsGeneration = 0;
let unsubscribeFromMeshCartChanges = null;
let watchingIntervalId = null;
let isStartInFlight = false;

/** @type {Set<(cart: object) => void>} */
const listeners = new Set();

/**
 * Calls every registered listener with one pushed cart.
 *
 * @param {object} cart - cart-sync/changed payload.
 * @returns {void}
 */
function notifyListeners(cart) {
  listeners.forEach((listener) => listener(cart));
}

/**
 * Tells the gateway this WebSocket should receive this user's saved cart.
 *
 * @returns {void}
 * @sideEffects Publishes cart-sync/watching with distributed scope.
 */
function publishWatchingAnnounce() {
  mesh.publish({
    topic: CART_SYNC_TOPIC,
    event: CART_WATCHING_EVENT,
    payload: {},
    scope: "distributed",
  });
}

/**
 * Starts the watching announce and the mesh subscription when this tab has a token.
 *
 * @param {object} appState - Shell state holding the authenticated session.
 * @returns {Promise<void>}
 * @sideEffects Publishes cart-sync/watching on an interval and subscribes to cart-sync/changed.
 */
async function startCartLiveEvents(appState) {
  if (!appState.authToken || unsubscribeFromMeshCartChanges || isStartInFlight) {
    return;
  }

  const generation = ++liveEventsGeneration;
  isStartInFlight = true;
  try {
    await mesh.whenConnected({ timeoutMs: MESH_CONNECT_TIMEOUT_MS });
    if (generation !== liveEventsGeneration || !appState.authToken) {
      return;
    }
    publishWatchingAnnounce();
    unsubscribeFromMeshCartChanges = mesh.subscribe(
      CART_SYNC_TOPIC,
      CART_CHANGED_EVENT_TYPE,
      (message) => {
        notifyListeners(message.payload);
      },
    );
    watchingIntervalId = window.setInterval(
      publishWatchingAnnounce,
      WATCHING_ANNOUNCE_INTERVAL_MS,
    );
  } catch (error) {
    console.warn("startCartLiveEvents - error");
    console.warn(error);
  } finally {
    if (generation === liveEventsGeneration) {
      isStartInFlight = false;
    }
  }
}

/**
 * Stops the watching announce and the mesh subscription without closing the mesh client.
 *
 * @returns {void}
 * @sideEffects Clears the watching interval and removes the mesh subscription.
 */
function stopCartLiveEvents() {
  liveEventsGeneration += 1;
  isStartInFlight = false;

  if (watchingIntervalId) {
    window.clearInterval(watchingIntervalId);
    watchingIntervalId = null;
  }

  if (unsubscribeFromMeshCartChanges) {
    unsubscribeFromMeshCartChanges();
    unsubscribeFromMeshCartChanges = null;
  }
}

/**
 * Registers a local listener for carts pushed on cart-sync/changed.
 *
 * Safe to call at any time, including before the mesh session starts: this only adds
 * to an in-memory registry and never touches the mesh client directly, so it cannot
 * trigger EventMesh's lazy singleton ahead of configureMesh().
 *
 * @param {(cart: object) => void} listener - Called with each cart-sync/changed payload.
 * @returns {() => void} Removes this listener from the registry.
 * @sideEffects Mutates the module-local listener registry.
 */
function subscribeToCartLiveEvents(listener) {
  listeners.add(listener);
  return function unsubscribeFromCartLiveEvents() {
    listeners.delete(listener);
  };
}

export { startCartLiveEvents, stopCartLiveEvents, subscribeToCartLiveEvents };
