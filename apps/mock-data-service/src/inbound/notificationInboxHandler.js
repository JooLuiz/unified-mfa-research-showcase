/**
 * Handles authenticated notification-inbox commands received through the event-mesh gateway.
 * Role: Adapts mark-read and mark-all-read messages to the shared read use cases and replies
 *   accepted or rejected.
 * Not in this file: Read and broadcast steps (src/domain/markNotificationRead.js), the GET list
 *   route (src/routes/notificationInboxRoutes.js), or the watcher registry
 *   (src/infrastructure/notificationInboxEvents.js).
 * Key dependencies: src/domain/markNotificationRead.js; event-mesh/gateway.
 * See also: src/server.js; src/inbound/cartUpsertHandler.js (same reply shape).
 *   On main the same use cases are called from src/routes/notificationInboxRoutes.js (PUT routes).
 */

const {
  markAllNotificationsReadForUser,
  markNotificationReadForUser,
} = require("../domain/markNotificationRead");
const { INVALID_REQUEST_CODE } = require("../domain/useCaseCodes");

const NOTIFICATION_INBOX_TOPIC = "notification-inbox";
const NOTIFICATION_INBOX_MARK_READ_EVENT = "mark-read";
const NOTIFICATION_INBOX_MARK_ALL_READ_EVENT = "mark-all-read";
const NOTIFICATION_INBOX_READ_ACCEPTED_EVENT = "read-accepted";
const NOTIFICATION_INBOX_READ_REJECTED_EVENT = "read-rejected";
const NOTIFICATION_INBOX_READ_ALL_ACCEPTED_EVENT = "read-all-accepted";
const NOTIFICATION_INBOX_READ_ALL_REJECTED_EVENT = "read-all-rejected";

/**
 * Registers the gateway subscribers that process mark-read and mark-all-read commands.
 *
 * @param {object} jsonStore - JSON store bound to service data files.
 * @param {{ broadcastNotificationChanged: (userId: string, shell: string, notification: object) => void }} notificationInboxEventStream - Per-(user, shell) publisher.
 * @returns {Promise<void>}
 * @sideEffects Subscribes to notification-inbox command events on the local gateway singleton.
 */
async function registerNotificationInboxHandler(jsonStore, notificationInboxEventStream) {
  const gatewayModule = await import("event-mesh/gateway");
  const gateway = gatewayModule.default;

  /**
   * Runs one read use case for the sender and replies with the outcome.
   *
   * @param {object} incomingMessage - Gateway message.
   * @param {typeof markNotificationReadForUser} readUseCase - The use case to run.
   * @param {{ accepted: string, rejected: string, resultField: string }} replyEvents - Reply events and the accepted payload field.
   * @returns {Promise<void>}
   * @sideEffects Replies to the sender; the use case writes and broadcasts on success.
   */
  async function handleReadCommand(incomingMessage, readUseCase, replyEvents) {
    const userId = incomingMessage.credential?.userId;
    const requestId = typeof incomingMessage.payload?.requestId === "string"
      ? incomingMessage.payload.requestId
      : null;

    const readResult = userId
      ? await readUseCase({
          jsonStore,
          userId,
          payload: incomingMessage.payload,
          streams: { notificationInbox: notificationInboxEventStream },
        })
      : { ok: false, code: INVALID_REQUEST_CODE };

    gateway.reply(incomingMessage, {
      topic: NOTIFICATION_INBOX_TOPIC,
      event: readResult.ok ? replyEvents.accepted : replyEvents.rejected,
      payload: readResult.ok
        ? { requestId, [replyEvents.resultField]: readResult.result }
        : { requestId, code: readResult.code },
    });
  }

  gateway.subscribe(NOTIFICATION_INBOX_TOPIC, NOTIFICATION_INBOX_MARK_READ_EVENT, (incomingMessage) =>
    handleReadCommand(incomingMessage, markNotificationReadForUser, {
      accepted: NOTIFICATION_INBOX_READ_ACCEPTED_EVENT,
      rejected: NOTIFICATION_INBOX_READ_REJECTED_EVENT,
      resultField: "notification",
    }),
  );
  gateway.subscribe(NOTIFICATION_INBOX_TOPIC, NOTIFICATION_INBOX_MARK_ALL_READ_EVENT, (incomingMessage) =>
    handleReadCommand(incomingMessage, markAllNotificationsReadForUser, {
      accepted: NOTIFICATION_INBOX_READ_ALL_ACCEPTED_EVENT,
      rejected: NOTIFICATION_INBOX_READ_ALL_REJECTED_EVENT,
      resultField: "items",
    }),
  );
}

module.exports = { registerNotificationInboxHandler };
