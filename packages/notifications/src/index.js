/**
 * Public notification APIs for shell toast delivery.
 * Role: Exposes the mesh notification adapter, payload contract, and toast center.
 * Not in this file: Toast behavior, mesh configuration, or event-mesh client setup.
 * Key dependencies: src/createMeshNotificationAdapter.js; src/notificationPayload.js.
 * See also: src/mountNotificationCenter.js.
 */

export { createMeshNotificationAdapter } from "./createMeshNotificationAdapter.js";
export {
  NOTIFICATION_RAISED_EVENT,
  NOTIFICATION_TOPIC,
  isValidNotificationPayload,
} from "./notificationPayload.js";
export { mountNotificationCenter } from "./mountNotificationCenter.js";
