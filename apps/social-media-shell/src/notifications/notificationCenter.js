/**
 * Mounts the social media shell's persistent toast queue.
 * Role: Delegates toast rendering to the shared notification center with this shell's bus.
 * Not in this file: Business outcome decisions, backend transport, or route-specific UI.
 * Key dependencies: @shared/notifications; src/notifications/notificationAdapter.js.
 * See also: src/notifications/notificationAdapter.js.
 */

import "@shared/notifications/styles.css";
import { mountNotificationCenter as mountSharedNotificationCenter } from "@shared/notifications";
import { subscribeToNotifications } from "./notificationAdapter";

/**
 * Mounts the notification center in a persistent shell-level container.
 *
 * @param {HTMLElement} containerElement - Element that owns the rendered toast queue.
 * @returns {() => void} Function that clears pending timers, subscriptions, and rendered toasts.
 * @sideEffects Subscribes to notification events and mutates the supplied container.
 */
function mountNotificationCenter(containerElement) {
  return mountSharedNotificationCenter(containerElement, {
    subscribeToNotifications,
  });
}

export { mountNotificationCenter };
