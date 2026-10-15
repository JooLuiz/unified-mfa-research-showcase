import React from "react";
import { createRoot } from "react-dom/client";
import { NotificationBellView } from "./NotificationBellView";
import { NotificationsPageView } from "./NotificationsPageView";
import "./styles.css";

/**
 * Mounts the notification bell dropdown into a DOM container element.
 *
 * @param {HTMLElement} containerElement
 * @param {{ navigate: (path: string) => void }} props
 * @returns {() => void} Cleanup function
 */
export function mountNotificationBell(containerElement, props) {
  const root = createRoot(containerElement);
  root.render(<NotificationBellView navigate={props?.navigate} />);

  return () => {
    root.unmount();
  };
}

/**
 * Mounts the notifications full page into a DOM container element.
 *
 * @param {HTMLElement} containerElement
 * @param {{ navigate: (path: string) => void }} props
 * @returns {() => void} Cleanup function
 */
export function mountNotificationsPage(containerElement, props) {
  const root = createRoot(containerElement);
  root.render(<NotificationsPageView navigate={props?.navigate} />);

  return () => {
    root.unmount();
  };
}
