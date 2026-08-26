/**
 * Factory helpers for event-mesh gateway connection and message authorization.
 * Role: Validates mesh tickets at WebSocket upgrade and restricts client publish topics.
 * Not in this file: Ticket issuance or export job handling.
 * Key dependencies: src/domain/meshTickets.js consumeMeshTicket callback.
 * See also: src/server.js.
 */

const EXPORT_TOPIC = "exports";
const EXPORT_REQUESTED_EVENT = "requested";

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
      return null;
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
    if (!credential?.userId) {
      return false;
    }

    return (
      message.topic === EXPORT_TOPIC && message.event === EXPORT_REQUESTED_EVENT
    );
  };
}

module.exports = {
  createAuthenticateConnection,
  createAuthorizeMessage,
};
