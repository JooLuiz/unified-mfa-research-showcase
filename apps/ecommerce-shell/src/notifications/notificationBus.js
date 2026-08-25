/**
 * Provides the ecommerce shell's page-local notification transport.
 * Role: Binds the shared notification bus to this shell's namespaced event channel.
 * Not in this file: Toast rendering, notification state, backend delivery, or cross-tab communication.
 * Key dependencies: @shared/notifications.
 * See also: src/notifications/notificationCenter.js.
 */

import { createNotificationBus } from "@shared/notifications";

const { notify, subscribeToNotifications } = createNotificationBus({
  eventName: "ecommerce-shell:notification",
});

export { notify, subscribeToNotifications };
