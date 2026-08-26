/**
 * Serves authenticated CSV export downloads for the mock data service.
 * Role: Downloads completed export snapshots created through the event-mesh gateway.
 * Not in this file: CSV generation, mesh request handling, or gateway startup.
 * Key dependencies: JSON store; src/domain/auth.js; src/domain/exportJobs.js.
 * See also: src/event-mesh/exportRequestHandler.js; src/server.js.
 */

const express = require("express");
const { extractUserIdFromToken } = require("../domain/auth");
const {
  EXPORT_JOB_STATUSES,
  findExportJobForUser,
} = require("../domain/exportJobs");

function sendCsvAttachment(response, fileName, csvContent) {
  response.set({
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${fileName}"`,
  });
  response.send(csvContent);
}

/**
 * Creates CSV export download routes.
 *
 * @param {{ readJsonFile: (fileName: string) => Promise<unknown> }} jsonStore - JSON store bound to service data files.
 * @returns {import("express").Router} Router with export download endpoint.
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
   * GET /exports/:requestId/download. Auth: Bearer token. Output: completed CSV attachment.
   */
  router.get("/exports/:requestId/download", async (request, response) => {
    try {
      const user = await getAuthenticatedUser(request, response);
      if (!user) {
        return;
      }

      const exportJob = findExportJobForUser(request.params.requestId, user.id);
      if (!exportJob) {
        response.status(404).json({ message: "Export not found" });
        return;
      }

      if (exportJob.status !== EXPORT_JOB_STATUSES.completed) {
        response.status(409).json({
          message: "Export is not ready for download",
          status: exportJob.status,
        });
        return;
      }

      sendCsvAttachment(response, exportJob.fileName, exportJob.csvContent);
    } catch (error) {
      response.status(500).json({
        message: "Unable to download export",
        details: error.message,
      });
    }
  });

  return router;
}

module.exports = { createExportRouter };
