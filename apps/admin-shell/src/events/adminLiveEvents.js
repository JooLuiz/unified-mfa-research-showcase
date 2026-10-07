/**
 * Manages the admin shell's live-notifications mesh subscription.
 * Role: Announces this admin connection to the gateway and exposes a subscribe API for
 *   pages to react to live order and post events.
 * Not in this file: Raw mesh subscribe wiring (src/events/adminLiveEventsTransport.js),
 *   mesh session open/close (src/main.js), or toast/page rendering.
 * Key dependencies: event-mesh/mesh; src/utils/authActions.js.
 * See also: src/main.js (start from the authenticated mesh session, stop on downgrade).
 */

import mesh from "event-mesh/mesh";
import { isAdminAuthenticated } from "../utils/authActions";
import { subscribeToAdminActivity } from "./adminLiveEventsTransport";
import {
  ADMIN_LIVE_EVENT_NAME,
  ADMIN_TOPIC,
  ADMIN_WATCHING_EVENT,
} from "./adminLiveEventsContracts";

const WATCHING_ANNOUNCE_INTERVAL_MS = 10_000;
const MESH_CONNECT_TIMEOUT_MS = 5000;

let liveEventsGeneration = 0;
let unsubscribeFromActivity = null;
let watchingIntervalId = null;
let isStartInFlight = false;

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
 * Starts admin live-event subscriptions when this session is an authenticated admin.
 *
 * @param {object} appState - Shell state holding the authenticated admin session.
 * @returns {Promise<void>}
 * @sideEffects Publishes admin/watching and subscribes to order and post activity.
 */
async function startAdminLiveEvents(appState) {
  if (!isAdminAuthenticated(appState) || unsubscribeFromActivity || isStartInFlight) {
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
    unsubscribeFromActivity = subscribeToAdminActivity();
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
 * Stops admin live-event subscriptions without closing the mesh client.
 *
 * @returns {void}
 * @sideEffects Clears the watching interval and removes mesh subscribers.
 */
function stopAdminLiveEvents() {
  liveEventsGeneration += 1;
  isStartInFlight = false;

  if (watchingIntervalId) {
    window.clearInterval(watchingIntervalId);
    watchingIntervalId = null;
  }

  if (unsubscribeFromActivity) {
    unsubscribeFromActivity();
    unsubscribeFromActivity = null;
  }
}

/**
 * Subscribes to live admin events (order_created, post_created) fanned out from mesh.
 *
 * @param {(event: { type: string, data: object }) => void} listener - Called with each live event.
 * @returns {() => void} Unsubscribe function.
 * @sideEffects Registers a window event listener.
 */
function subscribeToAdminLiveEvents(listener) {
  function handleAdminLiveEvent(domEvent) {
    listener(domEvent.detail);
  }

  window.addEventListener(ADMIN_LIVE_EVENT_NAME, handleAdminLiveEvent);
  return function unsubscribeFromAdminLiveEvents() {
    window.removeEventListener(ADMIN_LIVE_EVENT_NAME, handleAdminLiveEvent);
  };
}

export { startAdminLiveEvents, stopAdminLiveEvents, subscribeToAdminLiveEvents };
