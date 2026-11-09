/**
 * Public notification APIs for shell toast delivery.
 * Role: Exposes the mesh notification adapter, the shared transport adapter, the payload contract, and the toast center.
 * Not in this file: Toast behavior, mesh configuration, or event-mesh client setup.
 * Key dependencies: src/createMeshNotificationAdapter.js; src/createNotificationAdapter.js; src/notificationPayload.js.
 * See also: src/mountNotificationCenter.js.
 */

export { createMeshNotificationAdapter } from "./createMeshNotificationAdapter.js";
export { createNotificationAdapter } from "./createNotificationAdapter.js";
export {
  NOTIFICATION_RAISED_EVENT,
  NOTIFICATION_TOPIC,
  createNotificationPayload,
  isValidNotificationPayload,
} from "./notificationPayload.js";
export { mountNotificationCenter } from "./mountNotificationCenter.js";
