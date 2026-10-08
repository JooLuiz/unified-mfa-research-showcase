/**
 * Factory helpers for event-mesh gateway connection and message authorization.
 * Role: Validates mesh tickets at WebSocket upgrade and restricts client publish topics.
 * Not in this file: Ticket issuance or export job handling.
 * Key dependencies: src/domain/connectionTickets.js consumeConnectionTicket callback.
 * See also: src/server.js.
 */

const EXPORT_TOPIC = "exports";
const EXPORT_REQUESTED_EVENT = "requested";
const ORDERS_TOPIC = "orders";
const ORDERS_REQUESTED_EVENT = "requested";
const ADMIN_TOPIC = "admin";
const ADMIN_WATCHING_EVENT = "watching";
const IFRAME_BRIDGE_TOPIC = "iframe-bridge";
const IFRAME_CHANNEL_REGISTERED_EVENT = "registered";
const IFRAME_CHANNEL_UNREGISTERED_EVENT = "unregistered";
const IFRAME_MESSAGE_EVENT = "message";
const CART_SYNC_TOPIC = "cart-sync";
const CART_WATCHING_EVENT = "watching";
const CART_UPSERT_EVENT = "upsert";
const GUEST_CREDENTIAL = Object.freeze({
  kind: "guest",
  roles: ["guest"],
});

/**
 * Builds the gateway authenticateConnection callback for connection ticket validation.
 *
 * @param {(ticketValue: string) => { userId: string, roles: string[] } | null} consumeConnectionTicket - Ticket consumer from connectionTickets domain.
 * @returns {import("event-mesh/gateway").AuthenticateConnection} Connection authentication callback.
 */
function createAuthenticateConnection(consumeConnectionTicket) {
  return async ({ url }) => {
    const ticketValue = url.searchParams.get("ticket");
    if (!ticketValue) {
      return GUEST_CREDENTIAL;
    }

    return consumeConnectionTicket(ticketValue);
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

    const isAdminWatchingMessage =
      message.topic === ADMIN_TOPIC &&
      message.event === ADMIN_WATCHING_EVENT &&
      Array.isArray(credential.roles) &&
      credential.roles.includes("admin");

    const isCartSyncMessage =
      message.topic === CART_SYNC_TOPIC &&
      (message.event === CART_WATCHING_EVENT || message.event === CART_UPSERT_EVENT);

    return (
      isAdminWatchingMessage ||
      isCartSyncMessage ||
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
