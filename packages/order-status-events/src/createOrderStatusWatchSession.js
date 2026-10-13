/**
 * One mesh subscription per tab for order status changes, with an optional watching announce.
 * Role: Opens the status-changed subscription (and, when configured, a recurring watching
 *   announce) once the mesh client is connected, and fans events out to listeners that may have
 *   registered before the socket opened.
 * Not in this file: Which topic/event names to use (the customer and admin clients pass that in)
 *   or the status write (src/requestOrderStatusChange.js).
 * Key dependencies: event-mesh/mesh.
 * See also: src/customerOrderStatusClient.js; src/adminOrderStatusClient.js;
 *   apps/admin-shell/src/events/adminLiveEvents.js (same ensure/reset shape).
 */

import mesh from "event-mesh/mesh";

const WATCHING_ANNOUNCE_INTERVAL_MS = 10_000;
const MESH_CONNECT_TIMEOUT_MS = 5000;

/**
 * Creates a tab-scoped order-status watch session. Call start once per signed-in session.
 *
 * @param {{ topic: string, watchingEvent?: string, statusChangedEvent: string, logName: string }} sessionInput -
 *   Mesh topic, the optional watching-announce event (the customer session announces
 *   orders/watching so the server's per-user registry can target it; the admin session passes
 *   no watchingEvent because it reuses the admin/watching announce already running in
 *   adminLiveEvents.js), the status event to subscribe to, and the name used in warning logs.
 * @returns {{ start: () => Promise<void>, stop: () => void, subscribe: (listener: (event: { orderId: string, status: string }) => void) => () => void }} Session controls.
 */
function createOrderStatusWatchSession({ topic, watchingEvent, statusChangedEvent, logName }) {
  /** @type {Set<(event: { orderId: string, status: string }) => void>} */
  const listeners = new Set();
  let sessionGeneration = 0;
  let unsubscribeFromMeshStatus = null;
  let watchingIntervalId = null;
  let isStartInFlight = false;

  /**
   * Calls every registered listener with one pushed status change.
   *
   * @param {{ orderId: string, status: string }} event - orders/status-changed or
   *   admin/order_status_changed payload.
   * @returns {void}
   */
  function notifyListeners(event) {
    listeners.forEach((listener) => listener(event));
  }

  /**
   * Tells the gateway this connection should receive this user's order status changes.
   * A no-op session (admin) has no watchingEvent and never calls this.
   *
   * @returns {void}
   * @sideEffects Publishes the watching event with distributed scope.
   */
  function publishWatchingAnnounce() {
    if (!watchingEvent) {
      return;
    }
    mesh.publish({
      topic,
      event: watchingEvent,
      payload: {},
      scope: "distributed",
    });
  }

  /**
   * Starts the mesh subscription, and the watching announce when configured, for this tab.
   *
   * @returns {Promise<void>}
   * @sideEffects Subscribes to the status-changed event and, when watchingEvent is set, publishes
   *   it immediately and then on an interval.
   */
  async function start() {
    if (unsubscribeFromMeshStatus || isStartInFlight) {
      return;
    }

    const generation = ++sessionGeneration;
    isStartInFlight = true;
    try {
      await mesh.whenConnected({ timeoutMs: MESH_CONNECT_TIMEOUT_MS });
      if (generation !== sessionGeneration) {
        return;
      }

      publishWatchingAnnounce();
      unsubscribeFromMeshStatus = mesh.subscribe(topic, statusChangedEvent, (message) => {
        notifyListeners(message.payload);
      });

      if (watchingEvent) {
        watchingIntervalId = window.setInterval(
          publishWatchingAnnounce,
          WATCHING_ANNOUNCE_INTERVAL_MS,
        );
      }
    } catch (error) {
      console.warn(`${logName} - error`);
      console.warn(error);
    } finally {
      if (generation === sessionGeneration) {
        isStartInFlight = false;
      }
    }
  }

  /**
   * Stops the mesh subscription and cancels any pending watching announce.
   *
   * @returns {void}
   * @sideEffects Clears the watching interval and removes the mesh subscription.
   */
  function stop() {
    sessionGeneration += 1;
    isStartInFlight = false;

    if (watchingIntervalId) {
      window.clearInterval(watchingIntervalId);
      watchingIntervalId = null;
    }

    if (unsubscribeFromMeshStatus) {
      unsubscribeFromMeshStatus();
      unsubscribeFromMeshStatus = null;
    }
  }

  /**
   * Registers a listener for the status-changed event. Safe to call before start: this only
   * adds to an in-memory registry and never touches the mesh client directly, so it cannot
   * trigger EventMesh's lazy singleton ahead of configureMesh().
   *
   * @param {(event: { orderId: string, status: string }) => void} listener - Called with each pushed status.
   * @returns {() => void} Unsubscribe function.
   * @sideEffects Mutates the module-local listener registry.
   */
  function subscribe(listener) {
    listeners.add(listener);
    return function unsubscribe() {
      listeners.delete(listener);
    };
  }

  return { start, stop, subscribe };
}

export { createOrderStatusWatchSession };
