/**
 * Creates a page-local notification transport bound to a shell-specific event name.
 * Role: Lets shell-owned handlers notify the persistent toast UI without coupling to route components.
 * Not in this file: Toast rendering, notification state, backend delivery, or cross-tab communication.
 * Key dependencies: Browser CustomEvent and window EventTarget APIs.
 * See also: src/mountNotificationCenter.js.
 */

/**
 * Creates a notification bus bound to the given event name.
 *
 * @param {{ eventName: string }} options - Shell-specific event name for the notification channel.
 * @returns {{ notify: (notification: object) => void, subscribeToNotifications: (listener: (notification: object) => void) => () => void }} Notification bus.
 */
function createNotificationBus({ eventName }) {
  if (!eventName || typeof eventName !== "string") {
    throw new Error("createNotificationBus requires an eventName string");
  }

  /**
   * Publishes a page-local notification request.
   *
   * @param {{ type: "success" | "error", title: string, message: string, durationMs?: number }} notification - Toast content and display behavior.
   * @returns {void}
   * @sideEffects Dispatches a CustomEvent on window.
   */
  function notify(notification) {
    window.dispatchEvent(
      new CustomEvent(eventName, {
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

    window.addEventListener(eventName, handleNotificationEvent);

    return () => {
      window.removeEventListener(eventName, handleNotificationEvent);
    };
  }

  return { notify, subscribeToNotifications };
}

export { createNotificationBus };
