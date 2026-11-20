/**
 * Fans the admin shell's live order and post events into local listeners.
 * Role: Subscribes to the admin live frames and keeps the listener list the admin pages already use.
 * Not in this file: Toast or page rendering, or the ticket exchange.
 * Key dependencies: The shell event interface.
 * See also: src/main.js; src/events/eventEndpoints.js.
 */

/** @type {Set<(event: { type: string, data: object }) => void>} */
const adminListeners = new Set();
let unsubscribeFromAdmin = null;

const ADMIN_LIVE_FRAMES = [
  { event: "order-created", type: "order_created" },
  { event: "post-created", type: "post_created" },
  { event: "likes-changed", type: "community.post-likes-changed" },
];

/**
 * Starts the admin live subscription when this tab is not already listening.
 *
 * @param {{ subscribe: Function }} transport - Event interface.
 * @returns {void}
 * @sideEffects Subscribes to admin-live order, post, and like frames.
 */
function startAdminLiveEvents(transport) {
  if (unsubscribeFromAdmin) {
    return;
  }
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
