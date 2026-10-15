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
const ORDERS_WATCHING_EVENT = "watching";
const ORDERS_STATUS_CHANGE_REQUESTED_EVENT = "status-change-requested";
const STOCK_TOPIC = "stock";
const STOCK_WATCHING_EVENT = "watching";
const STOCK_RESERVE_EVENT = "reserve";
const STOCK_RELEASE_EVENT = "release";
const COMMUNITY_LIKES_TOPIC = "community-likes";
const COMMUNITY_LIKES_WATCHING_EVENT = "watching";
const COMMUNITY_LIKES_TOGGLE_EVENT = "toggle";
const NOTIFICATION_INBOX_TOPIC = "notification-inbox";
const NOTIFICATION_INBOX_WATCHING_EVENT = "watching";
const NOTIFICATION_INBOX_MARK_READ_EVENT = "mark-read";
const NOTIFICATION_INBOX_MARK_ALL_READ_EVENT = "mark-all-read";
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

    const isStockMessage =
      message.topic === STOCK_TOPIC &&
      (message.event === STOCK_WATCHING_EVENT ||
        message.event === STOCK_RESERVE_EVENT ||
        message.event === STOCK_RELEASE_EVENT);

    const isCommunityLikesWatchingMessage =
      message.topic === COMMUNITY_LIKES_TOPIC &&
      message.event === COMMUNITY_LIKES_WATCHING_EVENT;

    if (credential?.kind === "guest") {
      // Guests may watch stock and community likes (both public counts), reserve/release
      // stock, and relay iframe-bridge messages, but never publish cart-sync — a guest hold
      // lives in guestHolds.json, not a saved cart — or toggle a like, which requires an author.
      return isIframeBridgeMessage || isStockMessage || isCommunityLikesWatchingMessage;
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

    const isOrderStatusMessage =
      message.topic === ORDERS_TOPIC &&
      (message.event === ORDERS_WATCHING_EVENT ||
        message.event === ORDERS_STATUS_CHANGE_REQUESTED_EVENT);

    const isCommunityLikesMessage =
      message.topic === COMMUNITY_LIKES_TOPIC &&
      (message.event === COMMUNITY_LIKES_WATCHING_EVENT ||
        message.event === COMMUNITY_LIKES_TOGGLE_EVENT);

    const isNotificationInboxMessage =
      message.topic === NOTIFICATION_INBOX_TOPIC &&
      (message.event === NOTIFICATION_INBOX_WATCHING_EVENT ||
        message.event === NOTIFICATION_INBOX_MARK_READ_EVENT ||
        message.event === NOTIFICATION_INBOX_MARK_ALL_READ_EVENT);

    return (
      isAdminWatchingMessage ||
      isCartSyncMessage ||
      isStockMessage ||
      isOrderStatusMessage ||
      isCommunityLikesMessage ||
      isNotificationInboxMessage ||
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
