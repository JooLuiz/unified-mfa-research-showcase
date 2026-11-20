/**
 * Provides the social media shell's page-local notification transport.
 * Role: Binds the shared notification adapter to the shell event interface.
 * Not in this file: Toast rendering or backend notification delivery.
 * Key dependencies: @shared/notifications; src/events/eventBus.js.
 * See also: src/notifications/notificationCenter.js.
 */

import { createNotificationAdapter } from "@shared/notifications";
import { shellTransport } from "../events/eventBus";

const { notify, subscribeToNotifications } = createNotificationAdapter(shellTransport);

const publishNotification = notify;

export { publishNotification, subscribeToNotifications };
