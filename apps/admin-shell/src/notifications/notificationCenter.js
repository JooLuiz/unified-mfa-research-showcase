/**
 * Mounts the admin shell's persistent toast queue.
 * Role: Delegates toast rendering to the shared mesh-backed notification center.
 * Not in this file: Business outcome decisions, backend transport, or route-specific UI.
 * Key dependencies: @shared/notifications; event-mesh/mesh.
 * See also: src/notifications/notificationAdapter.js; src/main.js.
 */

import "@shared/notifications/styles.css";
import { mountNotificationCenter as mountSharedNotificationCenter } from "@shared/notifications";
import mesh from "event-mesh/mesh";

/** @type {{ unmount: () => void, ensureNotificationDisplayListeners: () => void, resetNotificationDisplayListeners: () => void } | null} */
let notificationCenterLifecycle = null;

/**
 * Mounts the notification center in a persistent shell-level container.
 *
 * @param {HTMLElement} containerElement - Element that owns the rendered toast queue.
 * @returns {void}
 * @sideEffects Prepares the toast container; mesh subscription starts when ensure is called.
 */
function mountNotificationCenter(containerElement) {
  notificationCenterLifecycle = mountSharedNotificationCenter(
    containerElement,
    mesh,
  );
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
