/**
 * Mounts the ecommerce shell's persistent toast queue.
 * Role: Delegates toast rendering to the shared notification center with this shell's bus, and
 *   marks the originating persisted notification read when its toast is clicked.
 * Not in this file: Business outcome decisions, backend transport, or route-specific UI.
 * Key dependencies: @shared/notifications; @shared/notification-inbox-events;
 *   src/notifications/notificationAdapter.js.
 * See also: src/notifications/notificationAdapter.js.
 */

import "@shared/notifications/styles.css";
import { mountNotificationCenter as mountSharedNotificationCenter } from "@shared/notifications";
import { markNotificationRead } from "@shared/notification-inbox-events";
import { navigate } from "../utils/navigate";
import { subscribeToNotifications } from "./notificationAdapter";

/**
 * Mounts the notification center in a persistent shell-level container.
 *
 * @param {HTMLElement} containerElement - Element that owns the rendered toast queue.
 * @returns {() => void} Function that clears pending timers, subscriptions, and rendered toasts.
 * @sideEffects Subscribes to notification events and mutates the supplied container. Clicking a linked toast navigates to its link and marks its inbox row read when it has a notificationId.
 */
function mountNotificationCenter(containerElement) {
  return mountSharedNotificationCenter(containerElement, {
    subscribeToNotifications,
    onOpenLink: (notification) => {
      // Only linked toasts are clickable; markNotificationRead ignores a missing id.
      void markNotificationRead(notification.notificationId);
      navigate(notification.link);
    },
  });
}

export { mountNotificationCenter };
