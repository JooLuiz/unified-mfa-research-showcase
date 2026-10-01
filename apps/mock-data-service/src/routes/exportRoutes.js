/**
 * Serves authenticated CSV exports for the mock data service.
 * Role: Maps current-user orders and posts to downloadable CSV responses at GET /exports/*.csv.
 * Not in this file: CSV row building (src/domain/exportProcessing.js), JSON persistence, or data mutation routes.
 * Key dependencies: JSON store; src/domain/auth.js; src/domain/exportProcessing.js.
 * See also: src/server.js.
 */

const express = require("express");
const { extractUserIdFromToken } = require("../domain/auth");
const { EXPORT_KINDS, EXPORT_FILE_NAMES, buildExportCsv } = require("../domain/exportProcessing");

function sendCsvAttachment(response, fileName, csvContent) {
  response.set({
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${fileName}"`,
  });
  response.send(csvContent);
}

/**
 * Creates CSV export routes.
 *
 * @param {{ readJsonFile: (fileName: string) => Promise<unknown> }} jsonStore - JSON store bound to service data files.
 * @returns {import("express").Router} Router with current-user order and post CSV downloads.
 */
function createExportRouter(jsonStore) {
  const router = express.Router();

  async function getAuthenticatedUser(request, response) {
    const userId = extractUserIdFromToken(request.headers.authorization);
    if (!userId) {
      response.status(401).json({ message: "Missing or invalid token" });
      return null;
    }

    const users = await jsonStore.readJsonFile("users.json");
    const user = users.find((userRecord) => userRecord.id === userId);
    if (!user) {
      response.status(404).json({ message: "User not found" });
      return null;
    }
    return user;
  }

  /**
   * GET /exports/orders.csv. Auth: Bearer token. Output: current user's order-item CSV attachment.
   */
  router.get("/exports/orders.csv", async (request, response) => {
    try {
      const user = await getAuthenticatedUser(request, response);
      if (!user) {
        return;
      }

      const csvContent = await buildExportCsv(jsonStore, EXPORT_KINDS.orders, user);
      sendCsvAttachment(response, EXPORT_FILE_NAMES[EXPORT_KINDS.orders], csvContent);
    } catch (error) {
      response.status(500).json({
        message: "Unable to export orders",
        details: error.message,
      });
    }
  });

  /**
   * GET /exports/posts.csv. Auth: Bearer token. Output: current user's posts CSV attachment.
   */
  router.get("/exports/posts.csv", async (request, response) => {
    try {
      const user = await getAuthenticatedUser(request, response);
      if (!user) {
        return;
      }

      const csvContent = await buildExportCsv(jsonStore, EXPORT_KINDS.posts, user);
      sendCsvAttachment(response, EXPORT_FILE_NAMES[EXPORT_KINDS.posts], csvContent);
    } catch (error) {
      response.status(500).json({
        message: "Unable to export posts",
        details: error.message,
      });
    }
  });

  return router;
}

module.exports = { createExportRouter };