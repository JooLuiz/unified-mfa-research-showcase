/**
 * Provides the ecommerce shell's page-local notification transport.
 * Role: Binds the shared notification adapter to this shell's namespaced event channel.
 * Not in this file: Toast rendering, notification state, backend delivery, or cross-tab communication.
 * Key dependencies: @shared/notifications.
 * See also: src/notifications/notificationCenter.js.
 */

import { createNotificationAdapter } from "@shared/notifications";

const NOTIFICATION_EVENT_NAME = "ecommerce-shell:notification";

/**
 * Creates a window transport for this shell's notification channel.
 *
 * @returns {{ publish: (message: { payload: object }) => void, subscribe: (topic: string, event: string, callback: (message: { payload: object }) => void) => () => void }} Notification transport.
 * @sideEffects Dispatches and listens for the ecommerce notification CustomEvent.
 */
function createNotificationTransport() {
  function publish({ payload }) {
    window.dispatchEvent(
      new CustomEvent(NOTIFICATION_EVENT_NAME, {
        detail: payload,
      }),
    );
  }

  function subscribe(_topic, _event, callback) {
    function handleNotification(domEvent) {
      callback({ payload: domEvent.detail });
    }

    window.addEventListener(NOTIFICATION_EVENT_NAME, handleNotification);
    return function unsubscribeFromNotifications() {
      window.removeEventListener(NOTIFICATION_EVENT_NAME, handleNotification);
    };
  }

  return { publish, subscribe };
}

const { notify, subscribeToNotifications } = createNotificationAdapter(
  createNotificationTransport(),
);

const publishNotification = notify;

export { publishNotification, subscribeToNotifications };
