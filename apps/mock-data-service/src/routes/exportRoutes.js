/**
 * Serves authenticated CSV exports for the mock data service.
 * Role: Maps current-user orders and posts to downloadable CSV responses at GET /exports/*.csv.
 * Not in this file: CSV row building (src/domain/exportProcessing.js), JSON persistence, or data mutation routes.
 * Key dependencies: JSON store; src/domain/auth.js; src/domain/exportProcessing.js.
 * See also: src/server.js.
 */

const express = require("express");
const { resolveAuthenticatedUserId } = require("../domain/auth");
const { EXPORT_KINDS, buildExportCsv } = require("../domain/exportProcessing");
const { requestExport } = require("../domain/requestExport");

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

  /**
   * Authenticates the caller and resolves one export request, writing the error response when it fails.
   *
   * @param {import("express").Request} request - Incoming request with an Authorization header.
   * @param {import("express").Response} response - Response used for 401/404.
   * @param {string} kind - Export kind for this route.
   * @returns {Promise<{ user: object, kind: string, fileName: string } | null>} Resolved request, or null after an error response.
   */
  async function resolveExportRequest(request, response, kind) {
    const sessionRevocations = await jsonStore.readJsonFileWithDefault("sessionRevocations.json", []);
    const userId = resolveAuthenticatedUserId(request.headers.authorization, sessionRevocations);
    if (!userId) {
      response.status(401).json({ message: "Missing or invalid token" });
      return null;
    }

    const exportRequest = await requestExport({ jsonStore, userId, payload: { kind } });
    if (!exportRequest.ok) {
      response.status(404).json({ message: "User not found" });
      return null;
    }
    return exportRequest.result;
  }

  /**
   * GET /exports/orders.csv. Auth: Bearer token. Output: current user's order-item CSV attachment.
   */
  router.get("/exports/orders.csv", async (request, response) => {
    try {
      const exportRequest = await resolveExportRequest(request, response, EXPORT_KINDS.orders);
      if (!exportRequest) {
        return;
      }

      const csvContent = await buildExportCsv(jsonStore, exportRequest.kind, exportRequest.user);
      sendCsvAttachment(response, exportRequest.fileName, csvContent);
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
      const exportRequest = await resolveExportRequest(request, response, EXPORT_KINDS.posts);
      if (!exportRequest) {
        return;
      }

      const csvContent = await buildExportCsv(jsonStore, exportRequest.kind, exportRequest.user);
      sendCsvAttachment(response, exportRequest.fileName, csvContent);
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