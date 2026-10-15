/**
 * Routes for the notification inbox.
 * Role: Handles GET /notifications?shell=X. Mark-read and live push travel over event mesh.
 * Not in this file: Trigger side-effects or the mesh watcher registry.
 * Key dependencies: src/domain/auth.js, src/domain/notificationInbox.js.
 * See also: src/domain/notificationTriggers.js, src/event-mesh/notificationInboxHandler.js.
 */

const express = require("express");
const { resolveAuthenticatedUserId } = require("../domain/auth");
const { listNotificationsForUser } = require("../domain/notificationInbox");

const NOTIFICATION_INBOX_FILE_NAME = "notificationInbox.json";
const ALLOWED_SHELLS = new Set(["ecommerce", "social", "admin"]);

/**
 * Creates the notification inbox router.
 *
 * @param {{ readJsonFileWithDefault: (fileName: string, defaultValue: unknown) => Promise<unknown> }} jsonStore - JSON store bound to data folder.
 * @returns {import("express").Router} Router with the GET /notifications route.
 */
function createNotificationInboxRouter(jsonStore) {
  const router = express.Router();

  /**
   * Resolves the caller from the Authorization header.
   *
   * @param {import("express").Request} request - Incoming HTTP request.
   * @returns {Promise<string | null>} Authenticated user id, or null.
   */
  async function resolveCallerUserId(request) {
    const sessionRevocations = await jsonStore.readJsonFileWithDefault(
      "sessionRevocations.json",
      [],
    );
    return resolveAuthenticatedUserId(request.headers.authorization, sessionRevocations);
  }

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

  return router;
}

module.exports = { createNotificationInboxRouter };
