/**
 * Handles authenticated CSV export requests received through the event-mesh gateway.
 * Role: Adapts exports/requested messages to the requestExport use case, creates the export
 *   job, and replies with targeted outcomes.
 * Not in this file: Request validation (src/domain/requestExport.js), CSV serialization, ticket
 *   issuance, or HTTP download routes.
 * Key dependencies: src/domain/requestExport.js; src/domain/exportJobs.js;
 *   src/domain/exportProcessing.js.
 * See also: src/server.js; src/inbound/exportEvents.js.
 *   On main the same use case is called from src/routes/exportRoutes.js.
 */

const { createExportJob } = require("../domain/exportJobs");
const {
  EXPORT_KINDS,
  INVALID_EXPORT_REQUEST_CODE,
  processExportJob,
} = require("../domain/exportProcessing");
const { requestExport } = require("../domain/requestExport");
const { replyExportCompleted, replyExportFailed } = require("./exportEvents");

/**
 * Registers the gateway subscriber that processes exports/requested messages.
 *
 * @param {object} jsonStore - JSON store bound to service data files.
 * @returns {Promise<void>}
 * @sideEffects Subscribes to export request events on the local gateway singleton.
 */
async function registerExportRequestHandler(jsonStore) {
  const gatewayModule = await import("event-mesh/gateway");
  const gateway = gatewayModule.default;

  gateway.subscribe("exports", "requested", async (incomingMessage) => {
    const userId = incomingMessage.credential?.userId;
    const kind = incomingMessage.payload?.kind;
    const requestId =
      typeof incomingMessage.payload?.requestId === "string" &&
      incomingMessage.payload.requestId.trim() !== ""
        ? incomingMessage.payload.requestId
        : "unknown";

    if (!userId) {
      return;
    }

    const exportRequest = await requestExport({ jsonStore, userId, payload: incomingMessage.payload });
    if (!exportRequest.ok) {
      await replyExportFailed(incomingMessage, {
        requestId,
        kind: kind || EXPORT_KINDS.orders,
        code: INVALID_EXPORT_REQUEST_CODE,
      });
      return;
    }

    const { user, fileName } = exportRequest.result;
    const exportJob = createExportJob({
      userId: user.id,
      kind: exportRequest.result.kind,
      fileName,
    });

    setImmediate(() => {
      void processExportJob({
        jsonStore,
        exportJob,
        user,
        onCompleted: () =>
          replyExportCompleted(incomingMessage, {
            requestId,
            jobId: exportJob.id,
            kind: exportJob.kind,
          }),
        onFailed: (code) =>
          replyExportFailed(incomingMessage, {
            requestId,
            kind: exportJob.kind,
            code,
          }),
      });
    });
  });
}

module.exports = { registerExportRequestHandler };
