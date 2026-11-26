/**
 * Routes for the notification inbox.
 * Role: Handles GET /notifications?shell=X, PUT /notifications/read-all?shell=X,
 *   and PUT /notifications/:notificationId/read.
 * Not in this file: Trigger side-effects or connection storage internals.
 * Key dependencies: src/domain/auth.js, src/domain/notificationInbox.js.
 * See also: src/domain/notificationTriggers.js, src/infrastructure/notificationInboxEvents.js.
 *   On main this file also serves GET /notifications/stream; this branch publishes through the
 *   gateway (src/infrastructure/notificationInboxEvents.js).
 */

const express = require("express");
const { resolveAuthenticatedUserId } = require("../domain/auth");
const {
  listNotificationsForUser,
  NOTIFICATION_FORBIDDEN_CODE,
} = require("../domain/notificationInbox");
const {
  ALLOWED_SHELLS,
  markAllNotificationsReadForUser,
  markNotificationReadForUser,
} = require("../domain/markNotificationRead");
const { INVALID_REQUEST_CODE } = require("../domain/useCaseCodes");

const NOTIFICATION_INBOX_FILE_NAME = "notificationInbox.json";
const MARK_READ_FAILURE_STATUSES = Object.freeze({
  [NOTIFICATION_FORBIDDEN_CODE]: 403,
  [INVALID_REQUEST_CODE]: 400,
});

/**
 * Creates the notification inbox router.
 *
 * @param {{
 *   readJsonFileWithDefault: (fileName: string, defaultValue: any) => Promise<any>,
 *   writeJsonFile: (fileName: string, data: any) => Promise<void>
 * }} jsonStore - JSON store bound to data folder.
 * @param {{
 *   broadcastNotificationChanged: (userId: string, shell: string, notification: object) => void
 * }} notificationInboxEventStream - Live inbox publisher.
 * @returns {import("express").Router}
 */
function createNotificationInboxRouter(jsonStore, notificationInboxEventStream) {
  const router = express.Router();

  /**
   * Helper to extract authenticated userId from Authorization header or token query param.
   *
   * @param {import("express").Request} request
   * @returns {Promise<string | null>}
   */
  async function resolveCallerUserId(request) {
    const rawAuthHeader = request.headers.authorization;
    const tokenQuery = typeof request.query.token === "string" ? request.query.token : "";
    const authHeaderCandidate = rawAuthHeader || (tokenQuery ? `Bearer ${tokenQuery}` : "");

    const sessionRevocations = await jsonStore.readJsonFileWithDefault(
      "sessionRevocations.json",
      [],
    );
    return resolveAuthenticatedUserId(authHeaderCandidate, sessionRevocations);
  }

  /**
   * GET /notifications?shell=ecommerce|social|admin
   * Auth: Bearer token.
   * Returns every row for caller's userId and shell, read and unread, newest first.
   */
  router.get("/notifications", async (request, response) => {
    try {
      const userId = await resolveCallerUserId(request);
      if (!userId) {
        response.status(401).json({ message: "Missing or invalid token" });
        return;
      }

      const shell = typeof request.query.shell === "string" ? request.query.shell : "";
      if (!ALLOWED_SHELLS.has(shell)) {
        response.status(400).json({ message: "Valid shell query parameter required" });
        return;
      }

      const inboxData = await jsonStore.readJsonFileWithDefault(
        NOTIFICATION_INBOX_FILE_NAME,
        [],
      );
      const userNotifications = listNotificationsForUser(inboxData, userId, shell);

      response.json({
        total: userNotifications.length,
        items: userNotifications,
      });
    } catch (error) {
      response.status(500).json({
        message: "Unable to load notifications",
        details: error.message,
      });
    }
  });

  /**
   * PUT /notifications/read-all?shell=ecommerce|social|admin
   * Auth: Bearer token.
   * Marks every unread row for the caller and shell, persists, and pushes each changed row.
   */
  router.put("/notifications/read-all", async (request, response) => {
    try {
      const userId = await resolveCallerUserId(request);
      if (!userId) {
        response.status(401).json({ message: "Missing or invalid token" });
        return;
      }

      const markResult = await markAllNotificationsReadForUser({
        jsonStore,
        userId,
        payload: { shell: request.query.shell },
        streams: { notificationInbox: notificationInboxEventStream },
      });
      if (!markResult.ok) {
        response.status(400).json({ message: "Valid shell query parameter required" });
        return;
      }

      response.json({
        total: markResult.result.length,
        items: markResult.result,
      });
    } catch (error) {
      response.status(500).json({
        message: "Unable to mark notifications read",
        details: error.message,
      });
    }
  });

  /**
   * PUT /notifications/:notificationId/read
   * Auth: Bearer token.
   * Marks row read, persists file, pushes the updated row live, returns updated row.
   */
  router.put("/notifications/:notificationId/read", async (request, response) => {
    try {
      const userId = await resolveCallerUserId(request);
      if (!userId) {
        response.status(401).json({ message: "Missing or invalid token" });
        return;
      }

      const markResult = await markNotificationReadForUser({
        jsonStore,
        userId,
        payload: { notificationId: request.params.notificationId },
        streams: { notificationInbox: notificationInboxEventStream },
      });
      if (!markResult.ok) {
        response.status(MARK_READ_FAILURE_STATUSES[markResult.code] || 404).json({
          message: "Unable to mark notification read",
          code: markResult.code,
        });
        return;
      }

      response.json(markResult.result);
    } catch (error) {
      response.status(500).json({
        message: "Unable to mark notification read",
        details: error.message,
      });
    }
  });

  return router;
}

module.exports = { createNotificationInboxRouter };
