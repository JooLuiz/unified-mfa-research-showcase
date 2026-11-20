/**
 * Mounts the admin shell's persistent toast queue.
 * Role: Delegates toast rendering to the shared mesh-backed notification center, and marks the
 *   originating persisted notification read when its toast is clicked.
 * Not in this file: Business outcome decisions, backend transport, or route-specific UI.
 * Key dependencies: @shared/notifications; @shared/notification-inbox-events; event-mesh/mesh.
 * See also: src/notifications/notificationAdapter.js; src/main.js.
 */

import "@shared/notifications/styles.css";
import {
  createNotificationAdapter,
  mountNotificationCenter as mountSharedNotificationCenter,
} from "@shared/notifications";
import { markNotificationRead } from "@shared/notification-inbox-events";
import { shellTransport } from "../events/eventBus";
import { navigate } from "../utils/navigate";

/** @type {HTMLElement | null} */
let notificationContainer = null;
/** @type {(() => void) | null} */
let unsubscribeFromNotifications = null;

const { subscribeToNotifications } = createNotificationAdapter(shellTransport);

/**
 * Mounts the notification center in a persistent shell-level container.
 *
 * @param {HTMLElement} containerElement - Element that owns the rendered toast queue.
 * @returns {void}
 * @sideEffects Subscribes to shell notification messages. A toast that carries a link navigates
 *   to that path. A toast raised from a persisted inbox row is also marked read on click.
 */
function mountNotificationCenter(containerElement) {
  notificationContainer = containerElement;
  resetNotificationDisplayListeners();
  ensureNotificationDisplayListeners();
}

function ensureNotificationDisplayListeners() {
  if (unsubscribeFromNotifications || !notificationContainer) {
    return;
  }
  unsubscribeFromNotifications = mountSharedNotificationCenter(notificationContainer, {
    subscribeToNotifications,
    onOpenLink(notification) {
      if (notification.notificationId) {
        void markNotificationRead(notification.notificationId);
      }
      if (notification.link) {
        navigate(notification.link);
      }
    },
  });
}

function resetNotificationDisplayListeners() {
  if (unsubscribeFromNotifications) {
    unsubscribeFromNotifications();
    unsubscribeFromNotifications = null;
  }
}

export {
  mountNotificationCenter,
  ensureNotificationDisplayListeners,
  resetNotificationDisplayListeners,
};
