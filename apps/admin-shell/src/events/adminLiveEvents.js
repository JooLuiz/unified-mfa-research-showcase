/**
 * Manages the admin shell's live-notifications mesh subscription.
 * Role: Announces this admin connection to the gateway and fans admin/order_created and
 *   admin/post_created out to any number of local listeners, without exposing mesh timing
 *   constraints to callers.
 * Not in this file: Mesh session open/close (src/main.js) or toast/page rendering.
 * Key dependencies: event-mesh/mesh; src/utils/authActions.js; src/events/adminLiveEventsContracts.js.
 * See also: src/main.js (start from the authenticated mesh session, stop on downgrade);
 *   packages/shell-events/src/createShellEvents.js (same ensure/reset shape).
 */

import mesh from "event-mesh/mesh";
import { isAdminAuthenticated } from "../utils/authActions";
import {
  ADMIN_TOPIC,
  ADMIN_WATCHING_EVENT,
  ORDER_CREATED_EVENT_TYPE,
  POST_CREATED_EVENT_TYPE,
} from "./adminLiveEventsContracts";

const WATCHING_ANNOUNCE_INTERVAL_MS = 10_000;
const MESH_CONNECT_TIMEOUT_MS = 5000;

let liveEventsGeneration = 0;
let unsubscribeFromMeshActivity = null;
let watchingIntervalId = null;
let isStartInFlight = false;

/** @type {Set<(event: { type: string, data: object }) => void>} */
const listeners = new Set();

/**
 * Calls every registered listener with one live admin event.
 *
 * @param {{ type: string, data: object }} event - Order or post activity to fan out.
 * @returns {void}
 */
function notifyListeners(event) {
  listeners.forEach((listener) => listener(event));
}

/**
 * Tells the gateway this WebSocket belongs to an admin so later activity is targeted here.
 *
 * @returns {void}
 * @sideEffects Publishes admin/watching with distributed scope.
 */
function publishWatchingAnnounce() {
  mesh.publish({
    topic: ADMIN_TOPIC,
    event: ADMIN_WATCHING_EVENT,
    payload: {},
    scope: "distributed",
  });
}

/**
 * Starts the watching announce and the mesh subscription when this session is an authenticated admin.
 *
 * @param {object} appState - Shell state holding the authenticated admin session.
 * @returns {Promise<void>}
 * @sideEffects Publishes admin/watching on an interval and subscribes to order/post activity.
 */
async function startAdminLiveEvents(appState) {
  if (!isAdminAuthenticated(appState) || unsubscribeFromMeshActivity || isStartInFlight) {
    return;
  }

  const generation = ++liveEventsGeneration;
  isStartInFlight = true;
  try {
    await mesh.whenConnected({ timeoutMs: MESH_CONNECT_TIMEOUT_MS });
    if (generation !== liveEventsGeneration) {
      return;
    }

    publishWatchingAnnounce();

    const unsubscribeFromOrders = mesh.subscribe(
      ADMIN_TOPIC,
      ORDER_CREATED_EVENT_TYPE,
      (message) => {
        notifyListeners({ type: ORDER_CREATED_EVENT_TYPE, data: message.payload });
      },
    );
    const unsubscribeFromPosts = mesh.subscribe(
      ADMIN_TOPIC,
      POST_CREATED_EVENT_TYPE,
      (message) => {
        notifyListeners({ type: POST_CREATED_EVENT_TYPE, data: message.payload });
      },
    );
    unsubscribeFromMeshActivity = function unsubscribeFromAdminActivity() {
      unsubscribeFromOrders();
      unsubscribeFromPosts();
    };

    watchingIntervalId = window.setInterval(
      publishWatchingAnnounce,
      WATCHING_ANNOUNCE_INTERVAL_MS,
    );
  } catch (error) {
    console.warn("startAdminLiveEvents - error");
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
function stopAdminLiveEvents() {
  liveEventsGeneration += 1;
  isStartInFlight = false;

  if (watchingIntervalId) {
    window.clearInterval(watchingIntervalId);
    watchingIntervalId = null;
  }

  if (unsubscribeFromMeshActivity) {
    unsubscribeFromMeshActivity();
    unsubscribeFromMeshActivity = null;
  }
}

/**
 * Registers a local listener for live admin events (order_created, post_created).
 *
 * Safe to call at any time, including before the mesh session starts: this only adds
 * to an in-memory registry and never touches the mesh client directly, so it cannot
 * trigger EventMesh's lazy singleton ahead of configureMesh().
 *
 * @param {(event: { type: string, data: object }) => void} listener - Called with each live event.
 * @returns {() => void} Removes this listener from the registry.
 * @sideEffects Mutates the module-local listener registry.
 */
function subscribeToAdminLiveEvents(listener) {
  listeners.add(listener);
  return function unsubscribeFromAdminLiveEvents() {
    listeners.delete(listener);
  };
}

export { startAdminLiveEvents, stopAdminLiveEvents, subscribeToAdminLiveEvents };
