/**
 * Renders the full notification inbox page.
 * Role: Lists every inbox row for the signed-in shell and offers mark-one and mark-all read actions.
 * Not in this file: Row markup (NotificationItemRow.js) or the inbox HTTP client.
 * Key dependencies: @shared/notification-inbox-events.
 * See also: apps/notifications/src/NotificationItemRow.js.
 */

import React, { useState, useEffect } from "react";
import {
  subscribeToNotificationInbox,
  markNotificationRead,
  markAllNotificationsRead,
} from "@shared/notification-inbox-events";
import { NotificationItemRow } from "./NotificationItemRow";

/**
 * Renders the inbox page.
 *
 * @param {{ navigate?: (path: string) => void }} pageProps - Shell navigation used when a row with a link is opened.
 * @returns {import("react").ReactElement} The inbox heading, mark-all action, and row list.
 */
export function NotificationsPageView({ navigate }) {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const unsubscribe = subscribeToNotificationInbox((items) => {
      setNotifications(items || []);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  const unreadCount = notifications.filter((notification) => !notification.read).length;

  const handleMarkRead = (id) => {
    void markNotificationRead(id);
  };

  const handleMarkAllRead = () => {
    void markAllNotificationsRead();
  };

  const handleOpenLink = (notification) => {
    void markNotificationRead(notification.id);
    if (notification.link && typeof navigate === "function") {
      navigate(notification.link);
    }
  };

  return (
    <div className="notifications-page-container">
      <div className="notifications-page-header">
        <h1 className="notifications-page-title">Notification Inbox</h1>
        <button
          type="button"
          className="notifications-page-mark-all-btn"
          onClick={handleMarkAllRead}
          disabled={unreadCount === 0}
        >
          Mark all as read
        </button>
      </div>
      <div className="notifications-page-card">
        {notifications.length === 0 ? (
          <div className="notifications-page-empty">
            No notifications in your inbox.
          </div>
        ) : (
          notifications.map((notification) => (
            <NotificationItemRow
              key={notification.id}
              notification={notification}
              onOpenLink={handleOpenLink}
              onMarkRead={handleMarkRead}
            />
          ))
        )}
      </div>
    </div>
  );
}
