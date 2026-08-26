/**
 * Handles authenticated CSV export requests received through the event-mesh gateway.
 * Role: Creates export jobs from mesh requests and replies with targeted outcomes.
 * Not in this file: CSV serialization details, ticket issuance, or HTTP download routes.
 * Key dependencies: JSON store; src/domain/exportJobs.js; src/domain/exportProcessing.js.
 * See also: src/server.js; src/event-mesh/exportEvents.js.
 */

const { createExportJob } = require("../domain/exportJobs");
const {
  EXPORT_KINDS,
  EXPORT_FILE_NAMES,
  INVALID_EXPORT_REQUEST_CODE,
  processExportJob,
} = require("../domain/exportProcessing");
const { replyExportCompleted, replyExportFailed } = require("./exportEvents");

/**
 * Registers the gateway subscriber that processes exports.requested messages.
 *
 * @param {{ readJsonFile: (fileName: string) => Promise<unknown> }} jsonStore - JSON store bound to service data files.
 * @returns {Promise<void>}
 * @sideEffects Subscribes to export request events on the local gateway singleton.
 */
async function registerExportRequestHandler(jsonStore) {
  const gatewayModule = await import("event-mesh/gateway");
  const gateway = gatewayModule.default;

  gateway.subscribe("exports", "requested", async (incomingMessage) => {
    const userId = incomingMessage.credential?.userId;
    const kind = incomingMessage.payload?.kind;

    if (!userId) {
      return;
    }

    if (!Object.values(EXPORT_KINDS).includes(kind)) {
      await replyExportFailed(incomingMessage, {
        requestId: "unknown",
        kind: kind || EXPORT_KINDS.orders,
        code: INVALID_EXPORT_REQUEST_CODE,
      });
      return;
    }

    const users = await jsonStore.readJsonFile("users.json");
    const user = users.find((userRecord) => userRecord.id === userId);
    if (!user) {
      await replyExportFailed(incomingMessage, {
        requestId: "unknown",
        kind,
        code: INVALID_EXPORT_REQUEST_CODE,
      });
      return;
    }

    const exportJob = createExportJob({
      userId: user.id,
      kind,
      fileName: EXPORT_FILE_NAMES[kind],
    });

    setImmediate(() => {
      void processExportJob({
        jsonStore,
        exportJob,
        user,
        onCompleted: () =>
          replyExportCompleted(incomingMessage, {
            requestId: exportJob.id,
            kind: exportJob.kind,
          }),
        onFailed: (code) =>
          replyExportFailed(incomingMessage, {
            requestId: exportJob.id,
            kind: exportJob.kind,
            code,
          }),
      });
    });
  });
}

module.exports = { registerExportRequestHandler };
