/**
 * Creates a notification publisher and subscriber over an injected transport.
 * Role: Turns toast payloads into transport messages without choosing CustomEvents or Event Mesh.
 * Not in this file: Toast rendering or the shell-specific window event name.
 * Key dependencies: src/notificationPayload.js.
 * See also: src/mountNotificationCenter.js.
 */

import { createNotificationPayload } from "./notificationPayload.js";

const NOTIFICATIONS_TOPIC = "notifications";
const NOTIFICATION_REQUESTED_EVENT = "requested";

/**
 * Creates the notify and subscribe pair shells pass to the toast center.
 *
 * @param {{ publish: (message: { topic: string, event: string, payload: object, scope: string }) => void, subscribe: (topic: string, event: string, callback: (message: { payload: object }) => void) => () => void }} transport - Branch transport that delivers notification messages.
 * @returns {{ notify: (notification: object) => void, subscribeToNotifications: (listener: (notification: object) => void) => () => void }} Notification adapter.
 * @throws {Error} When the notification payload is missing required fields.
 */
function createNotificationAdapter({ publish, subscribe }) {
  /**
   * Publishes a page-local notification request.
   *
   * @param {{ type: "success" | "error", title: string, message: string, durationMs?: number }} notification - Toast content and display behavior.
   * @returns {void}
   * @sideEffects Publishes a notifications.requested message.
   */
  function notify(notification) {
    publish({
      topic: NOTIFICATIONS_TOPIC,
      event: NOTIFICATION_REQUESTED_EVENT,
      payload: createNotificationPayload(notification),
      scope: "local",
    });
  }

  /**
   * Subscribes to page-local notification requests.
   *
   * @param {(notification: { type: "success" | "error", title: string, message: string, durationMs?: number }) => void} listener - Handler invoked for each notification.
   * @returns {() => void} Function that removes the subscription.
   * @sideEffects Registers a transport subscription.
   */
  function subscribeToNotifications(listener) {
    return subscribe(NOTIFICATIONS_TOPIC, NOTIFICATION_REQUESTED_EVENT, (message) => {
      listener(message.payload);
    });
  }

  return { notify, subscribeToNotifications };
}

export { createNotificationAdapter, NOTIFICATIONS_TOPIC, NOTIFICATION_REQUESTED_EVENT };
