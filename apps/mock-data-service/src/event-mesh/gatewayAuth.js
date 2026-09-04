/**
 * Factory helpers for event-mesh gateway connection and message authorization.
 * Role: Validates mesh tickets at WebSocket upgrade and restricts client publish topics.
 * Not in this file: Ticket issuance or export job handling.
 * Key dependencies: src/domain/meshTickets.js consumeMeshTicket callback.
 * See also: src/server.js.
 */

const EXPORT_TOPIC = "exports";
const EXPORT_REQUESTED_EVENT = "requested";
const ORDERS_TOPIC = "orders";
const ORDERS_REQUESTED_EVENT = "requested";
const IFRAME_BRIDGE_TOPIC = "iframe-bridge";
const IFRAME_CHANNEL_REGISTERED_EVENT = "registered";
const IFRAME_CHANNEL_UNREGISTERED_EVENT = "unregistered";
const IFRAME_MESSAGE_EVENT = "message";
const GUEST_CREDENTIAL = Object.freeze({
  kind: "guest",
  roles: ["guest"],
});

/**
 * Builds the gateway authenticateConnection callback for mesh ticket validation.
 *
 * @param {(ticketValue: string) => { userId: string, roles: string[] } | null} consumeMeshTicket - Ticket consumer from meshTickets domain.
 * @returns {import("event-mesh/gateway").AuthenticateConnection} Connection authentication callback.
 */
function createAuthenticateConnection(consumeMeshTicket) {
  return async ({ url }) => {
    const ticketValue = url.searchParams.get("ticket");
    if (!ticketValue) {
      return GUEST_CREDENTIAL;
    }

    return consumeMeshTicket(ticketValue);
  };
}

/**
 * Builds the gateway authorizeMessage callback for client-originated publishes.
 *
 * @returns {import("event-mesh/gateway").AuthorizeMessage} Message authorization callback.
 */
function createAuthorizeMessage() {
  return ({ credential, message }) => {
    const isIframeBridgeMessage =
      message.topic === IFRAME_BRIDGE_TOPIC &&
      (message.event === IFRAME_CHANNEL_REGISTERED_EVENT ||
        message.event === IFRAME_CHANNEL_UNREGISTERED_EVENT ||
        message.event === IFRAME_MESSAGE_EVENT);

    if (credential?.kind === "guest") {
      return isIframeBridgeMessage;
    }

    if (!credential?.userId) {
      return false;
    }

    return (
      (message.topic === EXPORT_TOPIC &&
        message.event === EXPORT_REQUESTED_EVENT) ||
      (message.topic === ORDERS_TOPIC &&
        message.event === ORDERS_REQUESTED_EVENT) ||
      isIframeBridgeMessage
    );
  };
}

module.exports = {
  createAuthenticateConnection,
  createAuthorizeMessage,
};
