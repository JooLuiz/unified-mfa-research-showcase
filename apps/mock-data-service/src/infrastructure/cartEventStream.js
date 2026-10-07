/**
 * Pushes saved-cart changes to the browsers where that user is signed in.
 * Role: Owns the in-memory map of open cart SSE responses, keyed by user id.
 * Not in this file: Ticket checks, cart persistence, or the ecommerce shell client.
 * Key dependencies: None (pure Node response writes).
 * See also: src/routes/cartRoutes.js; src/routes/orderRoutes.js.
 */

const CART_CHANGED_EVENT_NAME = "cart_changed";

/**
 * Formats one cart_changed Server-Sent Event.
 *
 * @param {object} cart - Stored cart payload, including updatedAt.
 * @returns {string} SSE frame.
 */
function serializeCartChanged(cart) {
  return `event: ${CART_CHANGED_EVENT_NAME}\ndata: ${JSON.stringify(cart)}\n\n`;
}

/**
 * Creates a per-user cart event stream.
 *
 * @returns {{ registerClient: (userId: string, response: import("express").Response) => void, writeCartChanged: (response: import("express").Response, cart: object) => void, broadcastCartChanged: (userId: string, cart: object) => void }} Stream bound to an in-memory client map.
 */
function createCartEventStream() {
  /** @type {Map<string, Set<import("express").Response>>} */
  const connectedClientsByUserId = new Map();

  /**
   * Registers an open SSE response for one user.
   *
   * @param {string} userId - Authenticated user id from the connection ticket.
   * @param {import("express").Response} response - Open, header-flushed SSE response.
   * @returns {void}
   * @sideEffects Adds the response; removes it and the user key when the connection closes.
   */
  function registerClient(userId, response) {
    const existingClients = connectedClientsByUserId.get(userId);
    const userClients = existingClients || new Set();
    if (!existingClients) {
      connectedClientsByUserId.set(userId, userClients);
    }
    userClients.add(response);
    response.on("close", () => {
      userClients.delete(response);
      if (userClients.size === 0) {
        connectedClientsByUserId.delete(userId);
      }
    });
  }

  /**
   * Writes the current cart to one newly opened stream.
   *
   * @param {import("express").Response} response - The connection that just registered.
   * @param {object} cart - That user's current cart.
   * @returns {void}
   * @sideEffects Writes one SSE frame.
   */
  function writeCartChanged(response, cart) {
    response.write(serializeCartChanged(cart));
  }

  /**
   * Writes a cart change to every open stream for that user.
   *
   * @param {string} userId - User whose saved cart changed.
   * @param {object} cart - Cart to deliver, including updatedAt.
   * @returns {void}
   * @sideEffects Writes to that user's open SSE responses only.
   */
  function broadcastCartChanged(userId, cart) {
    const userClients = connectedClientsByUserId.get(userId);
    if (!userClients) {
      return;
    }
    const serializedMessage = serializeCartChanged(cart);
    for (const clientResponse of userClients) {
      clientResponse.write(serializedMessage);
    }
  }

  return { registerClient, writeCartChanged, broadcastCartChanged };
}

module.exports = { CART_CHANGED_EVENT_NAME, createCartEventStream };
