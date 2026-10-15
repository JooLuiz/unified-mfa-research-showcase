import React, { useState, useEffect, useRef } from "react";
import PrettyIcons from "js-pretty-icons";
import {
  subscribeToNotificationInbox,
  markNotificationRead,
} from "@shared/notification-inbox-events";
import { NotificationItemRow } from "./NotificationItemRow";
import { selectBellNotifications } from "./selectBellNotifications";

const BELL_DROPDOWN_MAX_ROWS = 5;

export function NotificationBellView({ navigate }) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const containerRef = useRef(null);

  useEffect(() => {
    const unsubscribe = subscribeToNotificationInbox((items) => {
      setNotifications(items || []);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // The badge and header count must reflect every unread row, independent of how many the
  // dropdown actually renders (capped by selectBellNotifications below).
  const unreadCount = notifications.filter((notification) => !notification.read).length;
  const displayedNotifications = selectBellNotifications(
    notifications,
    BELL_DROPDOWN_MAX_ROWS,
  );

  const handleToggle = () => {
    setIsOpen((current) => !current);
  };

  const handleMarkRead = (id) => {
    void markNotificationRead(id);
  };

  const handleOpenLink = (notification) => {
    void markNotificationRead(notification.id);
    setIsOpen(false);
    if (notification.link && typeof navigate === "function") {
      navigate(notification.link);
    }
  };

  const handleSeeAll = () => {
    setIsOpen(false);
    if (typeof navigate === "function") {
      navigate("/notifications");
    }
  };

  return (
    <div className="notification-bell-container" ref={containerRef}>
      <button
        type="button"
        className="notification-bell-button"
        onClick={handleToggle}
        aria-label="Notifications"
        title="Notifications"
      >
        <PrettyIcons icon="bell" width={20} height={20} />
        {unreadCount > 0 && (
          <span className="notification-bell-badge">{unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-dropdown-header">
            <span>Notifications</span>
            {unreadCount > 0 && <span>{unreadCount} unread</span>}
          </div>
          <div className="notification-dropdown-list">
            {displayedNotifications.length === 0 ? (
              <div className="notification-dropdown-empty">
                No notifications yet
              </div>
            ) : (
              displayedNotifications.map((notification) => (
                <NotificationItemRow
                  key={notification.id}
                  notification={notification}
                  onOpenLink={handleOpenLink}
                  onMarkRead={handleMarkRead}
                />
              ))
            )}
          </div>
          <div className="notification-dropdown-footer">
            <button
              type="button"
              className="notification-dropdown-see-all-btn"
              onClick={handleSeeAll}
            >
              See all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
