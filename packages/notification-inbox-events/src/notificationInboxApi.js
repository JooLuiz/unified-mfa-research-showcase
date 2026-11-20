/**
 * Notification inbox commands over an injected transport.
 * Role: Fetches the shell inbox and marks one row or the whole shell read.
 * Not in this file: The live subscription or in-memory inbox state (src/notificationInboxClient.js).
 * Key dependencies: The caller supplies the transport.
 * See also: src/notificationInboxClient.js.
 */

const NOTIFICATION_INBOX_TOPIC = "notification-inbox";

/**
 * Fetches notifications for a shell.
 *
 * @param {{ request: Function }} transport - Event interface.
 * @param {{ shell: string }} input - Shell name, such as ecommerce or admin.
 * @returns {Promise<object[]>} Inbox rows, or an empty list when the request fails.
 * @sideEffects Sends notification-inbox/fetch.
 */
export async function fetchNotificationInbox(transport, { shell }) {
  if (!transport || !shell) {
    return [];
  }
  const result = await transport.request({
    topic: NOTIFICATION_INBOX_TOPIC,
    event: "fetch",
    payload: { shell },
  });
  if (!result.ok) {
    throw new Error("fetchNotificationInbox - request failed");
  }
  return Array.isArray(result.items) ? result.items : [];
}

/**
 * Marks a single notification as read.
 *
 * @param {{ request: Function }} transport - Event interface.
 * @param {{ notificationId: string }} input - Notification id.
 * @returns {Promise<object>} The updated notification row.
 * @sideEffects Sends notification-inbox/mark-read.
 */
export async function markNotificationAsRead(transport, { notificationId }) {
  const result = await transport.request({
    topic: NOTIFICATION_INBOX_TOPIC,
    event: "mark-read",
    payload: { notificationId },
  });
  if (!result.ok) {
    throw new Error("markNotificationAsRead - request failed");
  }
  return result.notification;
}

/**
 * Marks every unread notification for the caller's shell as read.
 *
 * @param {{ request: Function }} transport - Event interface.
 * @param {{ shell: string }} input - Shell name.
 * @returns {Promise<object[]>} The shell's notifications after the update.
 * @sideEffects Sends notification-inbox/mark-all-read.
 */
export async function markAllNotificationsAsRead(transport, { shell }) {
  const result = await transport.request({
    topic: NOTIFICATION_INBOX_TOPIC,
    event: "mark-all-read",
    payload: { shell },
  });
  if (!result.ok) {
    throw new Error("markAllNotificationsAsRead - request failed");
  }
  return Array.isArray(result.items) ? result.items : [];
}
