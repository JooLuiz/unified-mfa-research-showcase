/**
 * Shared names for the notification-inbox mesh topic.
 * Role: Centralizes topic and event strings used by the inbox client.
 * Not in this file: HTTP fetch or the live-state manager.
 * Key dependencies: None.
 * See also: src/notificationInboxClient.js.
 */

export const NOTIFICATION_INBOX_TOPIC = "notification-inbox";
export const NOTIFICATION_INBOX_WATCHING_EVENT = "watching";
export const NOTIFICATION_INBOX_CHANGED_EVENT = "changed";
export const NOTIFICATION_INBOX_MARK_READ_EVENT = "mark-read";
export const NOTIFICATION_INBOX_MARK_ALL_READ_EVENT = "mark-all-read";
export const NOTIFICATION_INBOX_READ_ACCEPTED_EVENT = "read-accepted";
export const NOTIFICATION_INBOX_READ_REJECTED_EVENT = "read-rejected";
export const NOTIFICATION_INBOX_READ_ALL_ACCEPTED_EVENT = "read-all-accepted";
export const NOTIFICATION_INBOX_READ_ALL_REJECTED_EVENT = "read-all-rejected";

/** @deprecated SSE event name from the HTTP branch. Mesh uses NOTIFICATION_INBOX_CHANGED_EVENT. */
export const NOTIFICATION_INBOX_CHANGED_EVENT_NAME = "notification-inbox.changed";
