/**
 * Handles authenticated notification-inbox commands received through the event-mesh gateway.
 * Role: Marks one row or a whole shell read, replies to the sender, and pushes each changed row.
 * Not in this file: The GET list route (src/routes/notificationInboxRoutes.js) or the watcher
 *   registry (src/infrastructure/notificationInboxEventStream.js).
 * Key dependencies: JSON store; src/domain/notificationInbox.js; event-mesh/gateway.
 * See also: src/server.js; src/event-mesh/cartUpsertHandler.js (same reply shape).
 */

const {
  NOTIFICATION_FORBIDDEN_CODE,
  NOTIFICATION_NOT_FOUND_CODE,
  listNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead,
} = require("../domain/notificationInbox");

const NOTIFICATION_INBOX_TOPIC = "notification-inbox";
const NOTIFICATION_INBOX_MARK_READ_EVENT = "mark-read";
const NOTIFICATION_INBOX_MARK_ALL_READ_EVENT = "mark-all-read";
const NOTIFICATION_INBOX_READ_ACCEPTED_EVENT = "read-accepted";
const NOTIFICATION_INBOX_READ_REJECTED_EVENT = "read-rejected";
const NOTIFICATION_INBOX_READ_ALL_ACCEPTED_EVENT = "read-all-accepted";
const NOTIFICATION_INBOX_READ_ALL_REJECTED_EVENT = "read-all-rejected";
const NOTIFICATION_INBOX_FILE_NAME = "notificationInbox.json";
const INVALID_REQUEST_CODE = "invalid-request";
const ALLOWED_SHELLS = new Set(["ecommerce", "social", "admin"]);

/**
 * Registers the gateway subscribers that process mark-read and mark-all-read commands.
 *
 * @param {{ readJsonFileWithDefault: (fileName: string, defaultValue: unknown) => Promise<unknown>, writeJsonFile: (fileName: string, data: unknown) => Promise<void> }} jsonStore - JSON store bound to service data files.
 * @param {{ broadcastNotificationChanged: (userId: string, shell: string, notification: object) => void }} notificationInboxEventStream - Per-(user, shell) publisher.
 * @returns {Promise<void>}
 * @sideEffects Subscribes to notification-inbox command events on the local gateway singleton.
 */
async function registerNotificationInboxHandler(jsonStore, notificationInboxEventStream) {
  const gatewayModule = await import("event-mesh/gateway");
  const gateway = gatewayModule.default;

  gateway.subscribe(NOTIFICATION_INBOX_TOPIC, NOTIFICATION_INBOX_MARK_READ_EVENT, async (incomingMessage) => {
    const userId = incomingMessage.credential?.userId;
    const requestId = typeof incomingMessage.payload?.requestId === "string"
      ? incomingMessage.payload.requestId
      : null;
    const notificationId = incomingMessage.payload?.notificationId;

    if (!userId || typeof notificationId !== "string" || notificationId.trim() === "") {
      gateway.reply(incomingMessage, {
        topic: NOTIFICATION_INBOX_TOPIC,
        event: NOTIFICATION_INBOX_READ_REJECTED_EVENT,
        payload: { requestId, code: INVALID_REQUEST_CODE },
      });
      return;
    }

    const inboxData = await jsonStore.readJsonFileWithDefault(NOTIFICATION_INBOX_FILE_NAME, []);
    const markResult = markNotificationRead(inboxData, notificationId, userId);
    if (!markResult.ok) {
      const rejectedCode = markResult.code === NOTIFICATION_FORBIDDEN_CODE
        ? NOTIFICATION_FORBIDDEN_CODE
        : NOTIFICATION_NOT_FOUND_CODE;
      gateway.reply(incomingMessage, {
        topic: NOTIFICATION_INBOX_TOPIC,
        event: NOTIFICATION_INBOX_READ_REJECTED_EVENT,
        payload: { requestId, code: rejectedCode },
      });
      return;
    }

    await jsonStore.writeJsonFile(NOTIFICATION_INBOX_FILE_NAME, markResult.notifications);
    gateway.reply(incomingMessage, {
      topic: NOTIFICATION_INBOX_TOPIC,
      event: NOTIFICATION_INBOX_READ_ACCEPTED_EVENT,
      payload: { requestId, notification: markResult.notification },
    });
    notificationInboxEventStream.broadcastNotificationChanged(
      userId,
      markResult.notification.shell,
      markResult.notification,
    );
  });

  gateway.subscribe(NOTIFICATION_INBOX_TOPIC, NOTIFICATION_INBOX_MARK_ALL_READ_EVENT, async (incomingMessage) => {
    const userId = incomingMessage.credential?.userId;
    const requestId = typeof incomingMessage.payload?.requestId === "string"
      ? incomingMessage.payload.requestId
      : null;
    const shell = incomingMessage.payload?.shell;

    if (!userId || !ALLOWED_SHELLS.has(shell)) {
      gateway.reply(incomingMessage, {
        topic: NOTIFICATION_INBOX_TOPIC,
        event: NOTIFICATION_INBOX_READ_ALL_REJECTED_EVENT,
        payload: { requestId, code: INVALID_REQUEST_CODE },
      });
      return;
    }

    const inboxData = await jsonStore.readJsonFileWithDefault(NOTIFICATION_INBOX_FILE_NAME, []);
    const markResult = markAllNotificationsRead(inboxData, userId, shell);
    await jsonStore.writeJsonFile(NOTIFICATION_INBOX_FILE_NAME, markResult.notifications);

    const items = listNotificationsForUser(markResult.notifications, userId, shell);
    gateway.reply(incomingMessage, {
      topic: NOTIFICATION_INBOX_TOPIC,
      event: NOTIFICATION_INBOX_READ_ALL_ACCEPTED_EVENT,
      payload: { requestId, items },
    });
    markResult.changedNotifications.forEach((changedNotification) => {
      notificationInboxEventStream.broadcastNotificationChanged(userId, shell, changedNotification);
    });
  });
}

module.exports = { registerNotificationInboxHandler };
