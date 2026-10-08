/**
 * Publishes saved-cart changes to the Event Mesh clients watching that user.
 * Role: Tracks cart-sync/watching client ids per user and publishes cart-sync/changed only to them.
 * Not in this file: Cart persistence or the upsert subscriber (src/event-mesh/cartUpsertHandler.js).
 * Key dependencies: event-mesh/gateway.
 * See also: src/event-mesh/orderRequestHandler.js; src/server.js.
 *   On main this module writes Server-Sent Events; this branch publishes through the gateway.
 */

const CART_SYNC_TOPIC = "cart-sync";
const CART_WATCHING_EVENT = "watching";
const CART_CHANGED_EVENT = "changed";

/**
 * Creates the per-user cart publisher used after a save or a placed order.
 *
 * @returns {{ forgetClient: (clientId: string) => void, rememberClient: (userId: string, clientId: string) => void, registerWithGateway: () => Promise<void>, broadcastCartChanged: (userId: string, cart: object) => void }} Watcher registry and publisher.
 */
function createCartEventStream() {
  /** @type {Map<string, Set<string>>} */
  const clientIdsByUserId = new Map();
  /** @type {Map<string, string>} */
  const userIdByClientId = new Map();

  /**
   * Drops a mesh client from the user it was watching.
   *
   * @param {string} clientId - Gateway client id from onClientDisconnect.
   * @returns {void}
   * @sideEffects Removes the id from both watcher indexes.
   */
  function forgetClient(clientId) {
    const userId = userIdByClientId.get(clientId);
    if (!userId) {
      return;
    }
    userIdByClientId.delete(clientId);
    const clientIds = clientIdsByUserId.get(userId);
    if (!clientIds) {
      return;
    }
    clientIds.delete(clientId);
    if (clientIds.size === 0) {
      clientIdsByUserId.delete(userId);
    }
  }

  /**
   * Records that a gateway client should receive this user's cart changes.
   *
   * @param {string} userId - Authenticated user id from the connection credential.
   * @param {string} clientId - Gateway client id that announced watching, or that sent an upsert.
   * @returns {void}
   * @sideEffects Replaces a previous user mapping when the same socket announces a different user.
   */
  function rememberClient(userId, clientId) {
    const previousUserId = userIdByClientId.get(clientId);
    if (previousUserId && previousUserId !== userId) {
      forgetClient(clientId);
    }
    const existingClientIds = clientIdsByUserId.get(userId);
    const clientIds = existingClientIds || new Set();
    if (!existingClientIds) {
      clientIdsByUserId.set(userId, clientIds);
    }
    clientIds.add(clientId);
    userIdByClientId.set(clientId, userId);
  }

  /**
   * Subscribes to cart-sync/watching and records the sender under credential.userId.
   *
   * @returns {Promise<void>}
   * @sideEffects Registers a gateway subscriber. Call after gateway.start().
   */
  async function registerWithGateway() {
    const gatewayModule = await import("event-mesh/gateway");
    const gateway = gatewayModule.default;

    gateway.subscribe(CART_SYNC_TOPIC, CART_WATCHING_EVENT, (incomingMessage) => {
      const userId = incomingMessage.credential?.userId;
      const clientId = incomingMessage.sourceClientId;
      if (!userId || !clientId) {
        return;
      }
      rememberClient(userId, clientId);
    });
  }

  /**
   * Publishes one saved cart to every recorded client for that user.
   *
   * @param {string} userId - User whose saved cart changed.
   * @param {object} cart - Canonical cart, including updatedAt.
   * @returns {void}
   * @sideEffects Sends a targeted gateway.publish per watching client.
   */
  function broadcastCartChanged(userId, cart) {
    void publishToUserClients(userId, cart);
  }

  /**
   * Sends cart-sync/changed to each client id currently recorded for the user.
   *
   * @param {string} userId - User whose saved cart changed.
   * @param {object} cart - JSON payload forwarded unchanged.
   * @returns {Promise<void>}
   * @sideEffects Publishes through the event-mesh gateway.
   */
  async function publishToUserClients(userId, cart) {
    const clientIds = clientIdsByUserId.get(userId);
    if (!clientIds || clientIds.size === 0) {
      return;
    }
    const gatewayModule = await import("event-mesh/gateway");
    const gateway = gatewayModule.default;
    for (const clientId of clientIds) {
      gateway.publish({
        topic: CART_SYNC_TOPIC,
        event: CART_CHANGED_EVENT,
        payload: cart,
        targetClientId: clientId,
      });
    }
  }

  return { forgetClient, rememberClient, registerWithGateway, broadcastCartChanged };
}

module.exports = { createCartEventStream };
