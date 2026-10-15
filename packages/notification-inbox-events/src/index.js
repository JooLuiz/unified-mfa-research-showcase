/**
 * Public barrel for @shared/notification-inbox-events.
 */

export {
  NOTIFICATION_INBOX_CHANGED_EVENT_NAME,
  NOTIFICATION_INBOX_TOPIC,
} from "./contracts.js";

export {
  fetchNotificationInbox,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "./notificationInboxApi.js";

export {
  startNotificationInboxLiveEvents,
  stopNotificationInboxLiveEvents,
  subscribeToNotificationInbox,
  subscribeToNewInboxNotifications,
  getNotificationInboxState,
  markNotificationRead,
  markAllNotificationsRead,
} from "./notificationInboxClient.js";
