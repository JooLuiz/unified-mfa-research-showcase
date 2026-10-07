/**
 * Subscribes to admin activity events on the authenticated Event Mesh client.
 * Role: Listens for admin/order_created and admin/post_created and re-dispatches each
 *   payload as a window CustomEvent for shell-local page updates.
 * Not in this file: Watching announce, reconnect policy, or auth-session lifecycle
 *   (src/events/adminLiveEvents.js).
 * Key dependencies: event-mesh/mesh; src/events/adminLiveEventsContracts.js.
 * See also: apps/mock-data-service/src/infrastructure/adminEventStream.js.
 */

import mesh from "event-mesh/mesh";
import {
  ADMIN_LIVE_EVENT_NAME,
  ADMIN_TOPIC,
  ORDER_CREATED_EVENT_TYPE,
  POST_CREATED_EVENT_TYPE,
} from "./adminLiveEventsContracts";

/**
 * Re-dispatches a mesh admin activity payload as a window CustomEvent.
 *
 * @param {string} eventType - Mesh event name (order_created or post_created).
 * @param {object} payload - Order or post record from the gateway publish.
 * @returns {void}
 * @sideEffects Dispatches a window CustomEvent.
 */
function dispatchAdminLiveEvent(eventType, payload) {
  window.dispatchEvent(
    new CustomEvent(ADMIN_LIVE_EVENT_NAME, {
      detail: { type: eventType, data: payload },
    }),
  );
}

/**
 * Subscribes to admin order and post activity on the current mesh client.
 *
 * @returns {() => void} Removes both mesh subscriptions.
 * @sideEffects Registers mesh subscribers.
 */
function subscribeToAdminActivity() {
  const unsubscribeFromOrders = mesh.subscribe(
    ADMIN_TOPIC,
    ORDER_CREATED_EVENT_TYPE,
    (message) => {
      dispatchAdminLiveEvent(ORDER_CREATED_EVENT_TYPE, message.payload);
    },
  );
  const unsubscribeFromPosts = mesh.subscribe(
    ADMIN_TOPIC,
    POST_CREATED_EVENT_TYPE,
    (message) => {
      dispatchAdminLiveEvent(POST_CREATED_EVENT_TYPE, message.payload);
    },
  );

  return function unsubscribeFromAdminActivity() {
    unsubscribeFromOrders();
    unsubscribeFromPosts();
  };
}

export { subscribeToAdminActivity };
