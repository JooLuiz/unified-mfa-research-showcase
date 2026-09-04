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
 * @typedef {{ type: "success" | "error", title: string, message: string, durationMs?: number }} ShellNotification
 */

/**
 * @param {unknown} notificationPayload
 * @returns {notificationPayload is ShellNotification}
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

export {
  NOTIFICATION_TOPIC,
  NOTIFICATION_RAISED_EVENT,
  isValidNotificationPayload,
};
