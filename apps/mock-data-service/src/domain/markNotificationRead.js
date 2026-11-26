/**
 * Marks notification inbox rows read for the caller and notifies that caller's watchers.
 * Role: Two use cases: one row read, and every row in one shell read. Each persists the inbox
 *   and broadcasts each changed row.
 * Not in this file: Row update rules (src/domain/notificationInbox.js) or how a caller receives
 *   the outcome (HTTP status or gateway reply).
 * Key dependencies: src/domain/notificationInbox.js; src/domain/useCaseCodes.js.
 * See also: src/routes/notificationInboxRoutes.js.
 */

const {
  listNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead,
} = require("./notificationInbox");
const { INVALID_REQUEST_CODE } = require("./useCaseCodes");

const NOTIFICATION_INBOX_FILE_NAME = "notificationInbox.json";
const ALLOWED_SHELLS = new Set(["ecommerce", "social", "admin"]);

/**
 * Marks one row read.
 *
 * @param {{
 *   jsonStore: object,
 *   userId: string,
 *   payload: { notificationId?: unknown } | null | undefined,
 *   streams: { notificationInbox: { broadcastNotificationChanged: (userId: string, shell: string, notification: object) => void } },
 * }} markInput - Store, caller, target row, and broadcaster.
 * @returns {Promise<{ ok: true, result: object } | { ok: false, code: string }>} The updated row, or a failure code.
 * @sideEffects Writes notificationInbox.json; broadcasts the updated row.
 */
async function markNotificationReadForUser({ jsonStore, userId, payload, streams }) {
  const notificationId = payload?.notificationId;
  if (typeof notificationId !== "string" || notificationId.trim() === "") {
    return { ok: false, code: INVALID_REQUEST_CODE };
  }

  const inboxData = await jsonStore.readJsonFileWithDefault(NOTIFICATION_INBOX_FILE_NAME, []);
  const markResult = markNotificationRead(inboxData, notificationId, userId);
  if (!markResult.ok) {
    return markResult;
  }

  await jsonStore.writeJsonFile(NOTIFICATION_INBOX_FILE_NAME, markResult.notifications);
  streams.notificationInbox.broadcastNotificationChanged(
    userId,
    markResult.notification.shell,
    markResult.notification,
  );
  return { ok: true, result: markResult.notification };
}

/**
 * Marks every unread row in one shell read.
 *
 * @param {{
 *   jsonStore: object,
 *   userId: string,
 *   payload: { shell?: unknown } | null | undefined,
 *   streams: { notificationInbox: { broadcastNotificationChanged: (userId: string, shell: string, notification: object) => void } },
 * }} markAllInput - Store, caller, shell, and broadcaster.
 * @returns {Promise<{ ok: true, result: object[] } | { ok: false, code: string }>} The caller's rows for that shell, newest first, or a failure code.
 * @sideEffects Writes notificationInbox.json; broadcasts each changed row.
 */
async function markAllNotificationsReadForUser({ jsonStore, userId, payload, streams }) {
  const shell = payload?.shell;
  if (!ALLOWED_SHELLS.has(shell)) {
    return { ok: false, code: INVALID_REQUEST_CODE };
  }

  const inboxData = await jsonStore.readJsonFileWithDefault(NOTIFICATION_INBOX_FILE_NAME, []);
  const markResult = markAllNotificationsRead(inboxData, userId, shell);
  await jsonStore.writeJsonFile(NOTIFICATION_INBOX_FILE_NAME, markResult.notifications);
  markResult.changedNotifications.forEach((changedNotification) => {
    streams.notificationInbox.broadcastNotificationChanged(userId, shell, changedNotification);
  });

  return { ok: true, result: listNotificationsForUser(markResult.notifications, userId, shell) };
}

module.exports = {
  ALLOWED_SHELLS,
  markAllNotificationsReadForUser,
  markNotificationReadForUser,
};
