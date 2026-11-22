/**
 * Fans the admin shell's live order and post events into local listeners.
 * Role: Subscribes to the admin live frames, announces admin/watching, and keeps the listener list the admin pages already use.
 * Not in this file: Toast or page rendering, or the ticket exchange.
 * Key dependencies: The shell event interface.
 * See also: src/main.js; src/events/eventEndpoints.js.
 */

import {
  ADMIN_TOPIC,
  ADMIN_WATCHING_EVENT,
  POST_LIKES_CHANGED_EVENT_TYPE,
} from "./adminLiveEventsContracts.js";

const MESH_CONNECT_TIMEOUT_MS = 5000;

/** @type {Set<(event: { type: string, data: object }) => void>} */
const adminListeners = new Set();
let unsubscribeFromAdmin = null;

/**
 * Registers this admin tab for activity pushes once the socket is open.
 *
 * @param {{ publish?: Function, whenConnected?: Function }} transport - Event interface. A subscribe-only fake is ignored.
 * @returns {void}
 * @sideEffects Publishes admin/watching. A connect timeout is swallowed.
 */
function publishAdminWatching(transport) {
  if (!publishAfterConnect(transport)) {
    return;
  }
  transport.publish({
    topic: ADMIN_TOPIC,
    event: ADMIN_WATCHING_EVENT,
    payload: {},
    scope: "distributed",
  });
}

/**
 * Starts the socket, then lets the caller publish. A subscribe-only fake is skipped.
 *
 * @param {{ publish?: Function, whenConnected?: Function }} transport - Event interface.
 * @returns {boolean} True when the caller should publish.
 * @sideEffects Calls whenConnected. A closed client or a connect timeout does not throw.
 */
function publishAfterConnect(transport) {
  if (typeof transport.publish !== "function" || typeof transport.whenConnected !== "function") {
    return false;
  }
  try {
    const connected = transport.whenConnected({ timeoutMs: MESH_CONNECT_TIMEOUT_MS });
    if (connected && typeof connected.catch === "function") {
      connected.catch(() => {
        // The gateway only pushes to registered admin clients. The next start can register again.
      });
    }
  } catch {
    return false;
  }
  return true;
}

const ADMIN_LIVE_FRAMES = [
  { event: "order-created", type: "order_created" },
  { event: "post-created", type: "post_created" },
  { event: "likes-changed", type: POST_LIKES_CHANGED_EVENT_TYPE },
];

/**
 * Starts the admin live subscription when this tab is not already listening.
 *
 * @param {{ subscribe: Function, publish?: Function, whenConnected?: Function }} transport - Event interface.
 * @returns {void}
 * @sideEffects Subscribes to admin-live order, post, and like frames, and publishes admin/watching.
 */
function startAdminLiveEvents(transport) {
  if (unsubscribeFromAdmin) {
    return;
  }
  publishAdminWatching(transport);
  const unsubscribers = ADMIN_LIVE_FRAMES.map((frame) =>
    transport.subscribe("admin-live", frame.event, (message) => {
      const liveEvent = { type: frame.type, data: message.payload };
      adminListeners.forEach((listener) => listener(liveEvent));
    }),
  );
  unsubscribeFromAdmin = () => {
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  };
}

/**
 * Stops the admin live subscription.
 *
 * @returns {void}
 * @sideEffects Unsubscribes from the transport.
 */
function stopAdminLiveEvents() {
  if (unsubscribeFromAdmin) {
    unsubscribeFromAdmin();
    unsubscribeFromAdmin = null;
  }
}

/**
 * Subscribes to live admin events.
 *
 * @param {(event: { type: string, data: object }) => void} listener - Called with each live event.
 * @returns {() => void} Unsubscribe function.
 * @sideEffects Registers the listener.
 */
function subscribeToAdminLiveEvents(listener) {
  adminListeners.add(listener);
  return function unsubscribeFromAdminLiveEvents() {
    adminListeners.delete(listener);
  };
}

export { startAdminLiveEvents, stopAdminLiveEvents, subscribeToAdminLiveEvents };
