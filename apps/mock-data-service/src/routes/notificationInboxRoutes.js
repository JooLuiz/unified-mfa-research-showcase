/**
 * Routes for the notification inbox.
 * Role: Handles GET /notifications?shell=X, PUT /notifications/read-all?shell=X,
 *   PUT /notifications/:notificationId/read, and GET /notifications/stream?shell=X.
 * Not in this file: Trigger side-effects or connection storage internals.
 * Key dependencies: src/domain/auth.js, src/domain/notificationInbox.js, src/domain/identifiers.js.
 * See also: src/domain/notificationTriggers.js, src/infrastructure/notificationInboxEventStream.js.
 */

const express = require("express");
const { resolveAuthenticatedUserId } = require("../domain/auth");
const { generateIdentifier } = require("../domain/identifiers");
const {
  listNotificationsForUser,
  markNotificationRead,
  markAllNotificationsRead,
  NOTIFICATION_FORBIDDEN_CODE,
} = require("../domain/notificationInbox");

const NOTIFICATION_INBOX_FILE_NAME = "notificationInbox.json";
const NOTIFICATION_SSE_HEARTBEAT_INTERVAL_MS = 20_000;
const ALLOWED_SHELLS = new Set(["ecommerce", "social", "admin"]);

/**
 * Creates the notification inbox router.
 *
 * @param {{
 *   readJsonFileWithDefault: (fileName: string, defaultValue: any) => Promise<any>,
 *   writeJsonFile: (fileName: string, data: any) => Promise<void>
 * }} jsonStore - JSON store bound to data folder.
 * @param {{
 *   rememberClient: (userId: string, shell: string, clientId: string, response: import("express").Response) => void,
 *   forgetClient: (clientId: string) => void,
 *   broadcastNotificationChanged: (userId: string, shell: string, notification: object) => void
 * }} notificationInboxEventStream - SSE registry for live inbox push.
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

      const shell = typeof request.query.shell === "string" ? request.query.shell : "";
      if (!ALLOWED_SHELLS.has(shell)) {
        response.status(400).json({ message: "Valid shell query parameter required" });
        return;
      }

      const inboxData = await jsonStore.readJsonFileWithDefault(
        NOTIFICATION_INBOX_FILE_NAME,
        [],
      );
      const markResult = markAllNotificationsRead(inboxData, userId, shell);
      await jsonStore.writeJsonFile(
        NOTIFICATION_INBOX_FILE_NAME,
        markResult.notifications,
      );

      markResult.changedNotifications.forEach((changedNotification) => {
        notificationInboxEventStream.broadcastNotificationChanged(
          userId,
          shell,
          changedNotification,
        );
      });

      const userNotifications = listNotificationsForUser(
        markResult.notifications,
        userId,
        shell,
      );
      response.json({
        total: userNotifications.length,
        items: userNotifications,
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
   * Marks row read, persists file, pushes updated row via SSE, returns updated row.
   */
  router.put("/notifications/:notificationId/read", async (request, response) => {
    try {
      const userId = await resolveCallerUserId(request);
      if (!userId) {
        response.status(401).json({ message: "Missing or invalid token" });
        return;
      }

      const notificationId = request.params.notificationId;
      const inboxData = await jsonStore.readJsonFileWithDefault(
        NOTIFICATION_INBOX_FILE_NAME,
        [],
      );

      const markResult = markNotificationRead(inboxData, notificationId, userId);
      if (!markResult.ok) {
        const statusCode =
          markResult.code === NOTIFICATION_FORBIDDEN_CODE ? 403 : 404;
        response.status(statusCode).json({
          message: "Unable to mark notification read",
          code: markResult.code,
        });
        return;
      }

      await jsonStore.writeJsonFile(
        NOTIFICATION_INBOX_FILE_NAME,
        markResult.notifications,
      );

      notificationInboxEventStream.broadcastNotificationChanged(
        userId,
        markResult.notification.shell,
        markResult.notification,
      );

      response.json(markResult.notification);
    } catch (error) {
      response.status(500).json({
        message: "Unable to mark notification read",
        details: error.message,
      });
    }
  });

  /**
   * GET /notifications/stream?shell=X
   * Auth: Bearer token via Authorization header or ?token= query parameter.
   * Holds open SSE stream for (userId, shell), broadcasts notification-inbox.changed.
   */
  router.get("/notifications/stream", async (request, response) => {
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

    response.setHeader("Content-Type", "text/event-stream");
    response.setHeader("Cache-Control", "no-cache");
    response.setHeader("Connection", "keep-alive");
    response.flushHeaders();

    const clientId = generateIdentifier("notification-client");
    notificationInboxEventStream.rememberClient(userId, shell, clientId, response);

    const heartbeatIntervalId = setInterval(() => {
      response.write(": ping\n\n");
    }, NOTIFICATION_SSE_HEARTBEAT_INTERVAL_MS);

    response.on("close", () => {
      clearInterval(heartbeatIntervalId);
      notificationInboxEventStream.forgetClient(clientId);
    });
  });

  return router;
}

module.exports = { createNotificationInboxRouter };
