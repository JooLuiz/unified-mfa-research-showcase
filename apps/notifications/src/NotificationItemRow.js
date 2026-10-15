/**
 * Renders one inbox notification row for the bell dropdown and the inbox page.
 * Role: Shows title, message, and created time, and turns a row click into the host's open action.
 * Not in this file: Which rows are listed, or the mark-read HTTP call (NotificationBellView.js,
 *   NotificationsPageView.js, @shared/notification-inbox-events).
 * Key dependencies: None.
 * See also: apps/notifications/src/NotificationBellView.js; apps/notifications/src/NotificationsPageView.js.
 */

import React from "react";

/**
 * Formats a notification timestamp for display.
 *
 * @param {string} isoDateString - ISO createdAt value.
 * @returns {string} Locale date and time, or an empty string when the value is missing.
 */
function formatNotificationDateTime(isoDateString) {
  if (!isoDateString) {
    return "";
  }
  const dateValue = new Date(isoDateString);
  if (Number.isNaN(dateValue.getTime())) {
    return isoDateString;
  }
  return dateValue.toLocaleString();
}

/**
 * Renders one notification row.
 *
 * @param {{ notification: { id: string, title: string, message: string, read: boolean, createdAt?: string }, onOpenLink: (notification: object) => void, onMarkRead: (notificationId: string) => void }} rowProps - The row and its host callbacks.
 * @returns {import("react").ReactElement} A clickable row. "Mark as read" does not open the link.
 */
export function NotificationItemRow({
  notification,
  onOpenLink,
  onMarkRead,
}) {
  const isUnread = !notification.read;
  const createdAtLabel = formatNotificationDateTime(notification.createdAt);

  const handleRowClick = () => {
    onOpenLink(notification);
  };

  const handleMarkReadClick = (event) => {
    event.stopPropagation();
    onMarkRead(notification.id);
  };

  return (
    <div
      className={`notification-item${isUnread ? " unread" : ""}`}
      onClick={handleRowClick}
    >
      <p className="notification-item-title">{notification.title}</p>
      <p className="notification-item-message">{notification.message}</p>
      {createdAtLabel ? (
        <p className="notification-item-time">{createdAtLabel}</p>
      ) : null}
      {isUnread && (
        <div className="notification-item-actions">
          <button
            type="button"
            className="notification-item-read-btn"
            onClick={handleMarkReadClick}
          >
            Mark as read
          </button>
        </div>
      )}
    </div>
  );
}
