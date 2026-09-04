/**
 * Sends targeted notification events through the local event-mesh gateway.
 * Role: Translates server outcomes into reply-to-client notification mesh messages.
 * Not in this file: Order persistence, CSV exports, or HTTP routing.
 * Key dependencies: The linked event-mesh/gateway package.
 * See also: src/event-mesh/orderRequestHandler.js.
 */

const NOTIFICATION_TOPIC = "notifications";
const NOTIFICATION_RAISED_EVENT = "raised";

/**
 * Replies to the requesting client with a notification event.
 *
 * @param {import("event-mesh/gateway").GatewayIncomingMessageWithClientId} incomingMessage - Authenticated request message.
 * @param {{ type: "success" | "error", title: string, message: string, durationMs?: number }} notificationPayload - Toast payload safe for clients.
 * @returns {Promise<void>}
 * @sideEffects Sends a targeted reply through the event-mesh gateway.
 */
async function replyNotificationRaised(incomingMessage, notificationPayload) {
  const gatewayModule = await import("event-mesh/gateway");
  gatewayModule.default.reply(incomingMessage, {
    topic: NOTIFICATION_TOPIC,
    event: NOTIFICATION_RAISED_EVENT,
    payload: notificationPayload,
  });
}

module.exports = {
  replyNotificationRaised,
};
