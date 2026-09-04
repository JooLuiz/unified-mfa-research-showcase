/**
 * Publishes shell notifications through event mesh.
 * Role: Provides the producer-side API for raising notifications on the mesh.
 * Not in this file: Toast rendering, mesh configuration, or display subscription.
 * Key dependencies: event-mesh/mesh client; notificationPayload constants.
 * See also: src/mountNotificationCenter.js; src/notificationPayload.js.
 */

import {
  NOTIFICATION_TOPIC,
  NOTIFICATION_RAISED_EVENT,
} from "./notificationPayload.js";

/**
 * @typedef {{ type: "success" | "error", title: string, message: string, durationMs?: number }} ShellNotification
 */

/**
 * Creates a mesh-backed notification publisher for a shell.
 *
 * @param {{ mesh: { publish: (input: object) => void } }} adapterInput - Mesh client for publishing notifications.
 * @returns {{ publishNotification: (notification: ShellNotification, options?: { scope?: "local" | "distributed" }) => void }} Mesh notification publisher API.
 */
function createMeshNotificationAdapter({ mesh }) {
  /**
   * Publishes a notification through event mesh for the display subscriber to render.
   *
   * @param {ShellNotification} notification - Toast content and display behavior.
   * @param {{ scope?: "local" | "distributed" }} [options] - Mesh delivery scope.
   * @returns {void}
   * @sideEffects Publishes a mesh notification event.
   */
  function publishNotification(notification, { scope = "local" } = {}) {
    mesh.publish({
      topic: NOTIFICATION_TOPIC,
      event: NOTIFICATION_RAISED_EVENT,
      payload: notification,
      scope,
    });
  }

  return {
    publishNotification,
  };
}

export { createMeshNotificationAdapter };
