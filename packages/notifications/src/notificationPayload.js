/**
 * Validates the toast payload shared by every shell.
 * Role: Defines the notification shape adapters publish and the toast center renders.
 * Not in this file: Transport delivery or toast DOM.
 * Key dependencies: None.
 * See also: src/createNotificationAdapter.js; src/mountNotificationCenter.js.
 */

/**
 * Builds a toast payload from a caller-supplied notification.
 *
 * @param {{ type: "success" | "error", title: string, message: string, durationMs?: number }} notification - Toast content and optional display duration.
 * @returns {{ type: "success" | "error", title: string, message: string, durationMs?: number }} Payload safe to publish.
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
  return payload;
}

export { createNotificationPayload };
