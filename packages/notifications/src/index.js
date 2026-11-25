/**
 * Public notification APIs for shell toast delivery.
 * Role: Exposes the shared transport adapter, the payload contract, and the toast center.
 * Not in this file: Toast behavior, mesh configuration, or event-mesh client setup.
 * Key dependencies: src/createNotificationAdapter.js; src/notificationPayload.js.
 * See also: src/mountNotificationCenter.js.
 */

export {
  createNotificationAdapter,
  NOTIFICATION_TOPIC,
  NOTIFICATION_RAISED_EVENT,
} from "./createNotificationAdapter.js";
export { createNotificationPayload } from "./notificationPayload.js";
export { mountNotificationCenter } from "./mountNotificationCenter.js";
