/**
 * Shared notification event contract for event-mesh producers and display subscribers.
 * Role: Centralizes topic/event names and payload validation for notification toasts.
 * Not in this file: Mesh configuration, toast rendering, or gateway reply handling.
 * Key dependencies: None.
 * See also: src/createMeshNotificationAdapter.js; src/mountNotificationCenter.js.
 */

const NOTIFICATION_TOPIC = "notifications";
const NOTIFICATION_RAISED_EVENT = "raised";

/**
 * @typedef {{ type: "success" | "error", title: string, message: string, durationMs?: number, link?: string, notificationId?: string }} ShellNotification
 */

/**
 * Checks that a mesh payload is a toast the center can render. `notificationId` (present when
 * the toast was raised from a persisted inbox row) is not required, so it passes through
 * untouched to the renderer without needing its own check here.
 *
 * @param {unknown} notificationPayload - Payload from notifications/raised.
 * @returns {notificationPayload is ShellNotification} True when type, title, and message are present.
 */
function isValidNotificationPayload(notificationPayload) {
  if (!notificationPayload || typeof notificationPayload !== "object") {
    return false;
  }

  const typedPayload = /** @type {ShellNotification} */ (notificationPayload);
  return (
    (typedPayload.type === "success" || typedPayload.type === "error") &&
    typeof typedPayload.title === "string" &&
    typeof typedPayload.message === "string"
  );
}

/**
 * Builds a toast payload from a caller-supplied notification.
 *
 * @param {{ type: "success" | "error", title: string, message: string, durationMs?: number, link?: string, notificationId?: string }} notification - Toast content, optional display duration, optional detail path, and optional id of the persisted inbox row this toast was raised from.
 * @returns {{ type: "success" | "error", title: string, message: string, durationMs?: number, link?: string, notificationId?: string }} Payload safe to publish.
 * @throws {Error} When type, title, or message is missing.
 */
function createNotificationPayload(notification) {
  if (!notification || typeof notification !== "object") {
    throw new Error("createNotificationPayload requires a notification object");
  }
  if (notification.type !== "success" && notification.type !== "error") {
    throw new Error("createNotificationPayload requires type success or error");
  }
  if (typeof notification.title !== "string" || typeof notification.message !== "string") {
    throw new Error("createNotificationPayload requires title and message strings");
  }

  const payload = {
    type: notification.type,
    title: notification.title,
    message: notification.message,
  };
  if (notification.durationMs !== undefined) {
    payload.durationMs = notification.durationMs;
  }
  if (typeof notification.link === "string" && notification.link.length > 0) {
    payload.link = notification.link;
  }
  if (typeof notification.notificationId === "string" && notification.notificationId.length > 0) {
    payload.notificationId = notification.notificationId;
  }
  return payload;
}

export {
  NOTIFICATION_TOPIC,
  NOTIFICATION_RAISED_EVENT,
  createNotificationPayload,
  isValidNotificationPayload,
};
