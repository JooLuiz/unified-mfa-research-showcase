/**
 * Pure domain logic for durable notification inbox items.
 * Role: Constructs rows, finds admin user ids, filters notifications by user and shell, and marks items read.
 * Not in this file: File system persistence, HTTP routing, or SSE streaming.
 * Key dependencies: src/domain/identifiers.js.
 * See also: src/domain/notificationTriggers.js, apps/mock-data-service/data/notificationInbox.json.
 */

const { generateIdentifier } = require("./identifiers");

const NOTIFICATION_NOT_FOUND_CODE = "notification-not-found";
const NOTIFICATION_FORBIDDEN_CODE = "notification-forbidden";

/**
 * Builds a single notification inbox row.
 *
 * @param {{
 *   userId: string,
 *   shell: "ecommerce" | "social" | "admin",
 *   type: string,
 *   title: string,
 *   message: string,
 *   link: string
 * }} rowInput - Data fields describing the notification.
 * @returns {{
 *   id: string,
 *   userId: string,
 *   shell: string,
 *   type: string,
 *   title: string,
 *   message: string,
 *   link: string,
 *   read: boolean,
 *   createdAt: string
 * }} A complete notification inbox row.
 */
function buildNotificationRow({ userId, shell, type, title, message, link }) {
  return {
    id: generateIdentifier("notification"),
    userId,
    shell,
    type,
    title,
    message,
    link,
    read: false,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Returns all user IDs that have the "admin" role.
 *
 * @param {Array<{ id: string, role?: string }>} usersData - List of user records.
 * @returns {string[]} List of admin user IDs.
 */
function getAdminUserIds(usersData) {
  if (!Array.isArray(usersData)) {
    return [];
  }
  return usersData
    .filter((userRecord) => userRecord && userRecord.role === "admin")
    .map((userRecord) => userRecord.id);
}

/**
 * Lists notifications for a given user and shell, newest first.
 *
 * @param {Array<object>} notificationInboxData - Current array of notification rows.
 * @param {string} userId - Target user identifier.
 * @param {string} shell - Target shell identifier ("ecommerce" | "social" | "admin").
 * @returns {Array<object>} Filtered and sorted notifications.
 */
function listNotificationsForUser(notificationInboxData, userId, shell) {
  if (!Array.isArray(notificationInboxData)) {
    return [];
  }
  return notificationInboxData
    .filter((row) => row && row.userId === userId && row.shell === shell)
    .sort(
      (firstRow, secondRow) =>
        new Date(secondRow.createdAt).getTime() - new Date(firstRow.createdAt).getTime(),
    );
}

/**
 * Marks a notification row as read if it exists and belongs to the given user.
 *
 * @param {Array<object>} notificationInboxData - Current array of notification rows.
 * @param {string} notificationId - Notification row ID.
 * @param {string} userId - Requesting user ID.
 * @returns {{ ok: true, notifications: Array<object>, notification: object } | { ok: false, code: string }}
 */
function markNotificationRead(notificationInboxData, notificationId, userId) {
  if (!Array.isArray(notificationInboxData)) {
    return { ok: false, code: NOTIFICATION_NOT_FOUND_CODE };
  }

  const rowIndex = notificationInboxData.findIndex(
    (row) => row && row.id === notificationId,
  );
  if (rowIndex === -1) {
    return { ok: false, code: NOTIFICATION_NOT_FOUND_CODE };
  }

  const existingRow = notificationInboxData[rowIndex];
  if (existingRow.userId !== userId) {
    return { ok: false, code: NOTIFICATION_FORBIDDEN_CODE };
  }

  const updatedRow = {
    ...existingRow,
    read: true,
  };

  const updatedNotifications = [...notificationInboxData];
  updatedNotifications[rowIndex] = updatedRow;

  return {
    ok: true,
    notifications: updatedNotifications,
    notification: updatedRow,
  };
}

/**
 * Marks every unread row for one user and shell as read.
 *
 * @param {Array<object>} notificationInboxData - Current array of notification rows.
 * @param {string} userId - Requesting user ID.
 * @param {string} shell - Shell whose rows should be marked read.
 * @returns {{ notifications: Array<object>, changedNotifications: Array<object> }} The full list and the rows that changed.
 */
function markAllNotificationsRead(notificationInboxData, userId, shell) {
  if (!Array.isArray(notificationInboxData)) {
    return { notifications: [], changedNotifications: [] };
  }

  const changedNotifications = [];
  const notifications = notificationInboxData.map((row) => {
    if (!row || row.userId !== userId || row.shell !== shell || row.read) {
      return row;
    }
    const updatedRow = { ...row, read: true };
    changedNotifications.push(updatedRow);
    return updatedRow;
  });

  return { notifications, changedNotifications };
}

module.exports = {
  NOTIFICATION_NOT_FOUND_CODE,
  NOTIFICATION_FORBIDDEN_CODE,
  buildNotificationRow,
  getAdminUserIds,
  listNotificationsForUser,
  markNotificationRead,
  markAllNotificationsRead,
};
