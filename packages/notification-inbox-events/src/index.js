/**
 * Public barrel for @shared/notification-inbox-events.
 * Role: Re-exports the inbox fetch and the tab-scoped mesh client.
 * Not in this file: Transport implementation.
 * Key dependencies: None.
 * See also: src/notificationInboxClient.js.
 */

export {
  NOTIFICATION_INBOX_CHANGED_EVENT_NAME,
  NOTIFICATION_INBOX_TOPIC,
} from "./contracts.js";

export { fetchNotificationInbox } from "./notificationInboxApi.js";

export {
  startNotificationInboxLiveEvents,
  stopNotificationInboxLiveEvents,
  subscribeToNotificationInbox,
  subscribeToNewInboxNotifications,
  getNotificationInboxState,
  markNotificationRead,
  markAllNotificationsRead,
} from "./notificationInboxClient.js";
