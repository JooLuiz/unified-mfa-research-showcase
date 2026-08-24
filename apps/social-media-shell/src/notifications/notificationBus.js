/**
 * Provides the social media shell's page-local notification transport.
 * Role: Lets shell-owned HTTP result handlers notify the persistent toast UI without coupling to route components.
 * Not in this file: Toast rendering, notification state, backend delivery, or cross-tab communication.
 * Key dependencies: Browser CustomEvent and window EventTarget APIs.
 * See also: src/notifications/notificationCenter.js.
 */

const NOTIFICATION_EVENT_NAME = "social-media-shell:notification";

/**
 * Publishes a page-local notification request.
 *
 * @param {{ type: "success" | "error", title: string, message: string, durationMs?: number }} notification - Toast content and display behavior.
 * @returns {void}
 * @sideEffects Dispatches a CustomEvent on window.
 */
function notify(notification) {
  window.dispatchEvent(
    new CustomEvent(NOTIFICATION_EVENT_NAME, {
      detail: notification,
    }),
  );
}

/**
 * Subscribes to page-local notification requests.
 *
 * @param {(notification: { type: "success" | "error", title: string, message: string, durationMs?: number }) => void} listener - Handler invoked for each notification.
 * @returns {() => void} Function that removes the event listener.
 * @sideEffects Adds and later removes a window event listener.
 */
function subscribeToNotifications(listener) {
  function handleNotificationEvent(event) {
    listener(event.detail);
  }

  window.addEventListener(NOTIFICATION_EVENT_NAME, handleNotificationEvent);

  return () => {
    window.removeEventListener(NOTIFICATION_EVENT_NAME, handleNotificationEvent);
  };
}

export { notify, subscribeToNotifications };
