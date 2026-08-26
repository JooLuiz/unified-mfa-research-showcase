/**
 * Sends targeted CSV export lifecycle replies through the local event-mesh gateway.
 * Role: Translates export job outcomes into reply-to-client mesh messages.
 * Not in this file: Export job state, CSV serialization, or HTTP routing.
 * Key dependencies: The linked event-mesh/gateway package.
 * See also: src/event-mesh/exportRequestHandler.js; src/domain/exportJobs.js.
 */

const EXPORT_TOPIC = "exports";
const EXPORT_COMPLETED_EVENT = "completed";
const EXPORT_FAILED_EVENT = "failed";

/**
 * Replies to the requesting client with a successful export completion event.
 *
 * @param {import("event-mesh/gateway").GatewayIncomingMessageWithClientId} incomingMessage - Authenticated export request message.
 * @param {{ requestId: string, kind: "orders" | "posts" }} exportJob - Opaque job correlation data.
 * @returns {Promise<void>}
 * @sideEffects Sends a targeted reply through the event-mesh gateway.
 */
async function replyExportCompleted(incomingMessage, { requestId, kind }) {
  const gatewayModule = await import("event-mesh/gateway");
  gatewayModule.default.reply(incomingMessage, {
    topic: EXPORT_TOPIC,
    event: EXPORT_COMPLETED_EVENT,
    payload: { requestId, kind },
  });
}

/**
 * Replies to the requesting client with an export failure event.
 *
 * @param {import("event-mesh/gateway").GatewayIncomingMessageWithClientId} incomingMessage - Authenticated export request message.
 * @param {{ requestId: string, kind: "orders" | "posts", code: string }} exportJob - Opaque job correlation data and public failure code.
 * @returns {Promise<void>}
 * @sideEffects Sends a targeted reply through the event-mesh gateway.
 */
async function replyExportFailed(incomingMessage, { requestId, kind, code }) {
  const gatewayModule = await import("event-mesh/gateway");
  gatewayModule.default.reply(incomingMessage, {
    topic: EXPORT_TOPIC,
    event: EXPORT_FAILED_EVENT,
    payload: { requestId, kind, code },
  });
}

module.exports = {
  replyExportCompleted,
  replyExportFailed,
};
