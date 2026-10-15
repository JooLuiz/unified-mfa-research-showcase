/**
 * Pure selection logic for the bell dropdown's capped notification list.
 * Role: Orders notifications unread-first (each group newest-on-top) and caps the combined
 *   result at maxCount, so the dropdown always shows the most relevant rows first while still
 *   surfacing recently read ones when there aren't enough unread rows to fill the list.
 * Not in this file: Fetching, marking-as-read, or rendering (see notificationInboxClient.js in
 *   @shared/notification-inbox-events and NotificationBellView.js).
 * Key dependencies: None.
 * See also: apps/notifications/src/NotificationBellView.js.
 */

/**
 * Sorts a notification list by createdAt, newest first.
 *
 * @param {Array<{ createdAt: string }>} notifications - Notifications to sort.
 * @returns {Array<object>} A new array, sorted newest first.
 */
function sortByNewestFirst(notifications) {
  return [...notifications].sort(
    (firstNotification, secondNotification) =>
      new Date(secondNotification.createdAt).getTime() -
      new Date(firstNotification.createdAt).getTime(),
  );
}

/**
 * Selects up to maxCount notifications for the bell dropdown: every unread row (newest first),
 * then read rows (newest first) filling any remaining slots.
 *
 * @param {Array<{ read: boolean, createdAt: string }>} notifications - Full notification list for the shell.
 * @param {number} [maxCount] - Maximum number of rows to return. Defaults to 5.
 * @returns {Array<object>} At most maxCount notifications, unread rows first.
 */
function selectBellNotifications(notifications, maxCount = 5) {
  if (!Array.isArray(notifications)) {
    return [];
  }

  const unreadNewestFirst = sortByNewestFirst(
    notifications.filter((notification) => !notification.read),
  );
  const readNewestFirst = sortByNewestFirst(
    notifications.filter((notification) => notification.read),
  );

  return [...unreadNewestFirst, ...readNewestFirst].slice(0, maxCount);
}

export { selectBellNotifications };
