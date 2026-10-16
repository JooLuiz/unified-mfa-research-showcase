/**
 * Mounts the social media shell's persistent toast queue.
 * Role: Delegates toast rendering to the shared mesh-backed notification center, and marks the
 *   originating persisted notification read when its toast is clicked.
 * Not in this file: Business outcome decisions, backend transport, or route-specific UI.
 * Key dependencies: @shared/notifications; @shared/notification-inbox-events; event-mesh/mesh.
 * See also: src/notifications/notificationAdapter.js; src/main.js.
 */

import "@shared/notifications/styles.css";
import { mountNotificationCenter as mountSharedNotificationCenter } from "@shared/notifications";
import mesh from "event-mesh/mesh";
import { markNotificationRead } from "@shared/notification-inbox-events";
import { navigate } from "../utils/navigate";

/** @type {{ unmount: () => void, ensureNotificationDisplayListeners: () => void, resetNotificationDisplayListeners: () => void } | null} */
let notificationCenterLifecycle = null;

/**
 * Mounts the notification center in a persistent shell-level container.
 *
 * @param {HTMLElement} containerElement - Element that owns the rendered toast queue.
 * @returns {void}
 * @sideEffects Prepares the toast container; mesh subscription starts when ensure is called.
 *   A toast that carries a link navigates to that path. A toast raised from a persisted inbox
 *   row (it carries a notificationId) is also marked read on click.
 */
function mountNotificationCenter(containerElement) {
  notificationCenterLifecycle = mountSharedNotificationCenter(containerElement, mesh, {
    onOpenLink: (notification) => {
      if (notification.notificationId) {
        void markNotificationRead(notification.notificationId);
      }
      if (notification.link) {
        navigate(notification.link);
      }
    },
  });
}

function ensureNotificationDisplayListeners() {
  notificationCenterLifecycle?.ensureNotificationDisplayListeners();
}

function resetNotificationDisplayListeners() {
  notificationCenterLifecycle?.resetNotificationDisplayListeners();
}

export {
  mountNotificationCenter,
  ensureNotificationDisplayListeners,
  resetNotificationDisplayListeners,
};
