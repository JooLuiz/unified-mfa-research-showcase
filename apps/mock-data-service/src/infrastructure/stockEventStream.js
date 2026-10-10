/**
 * Publishes live stock availability to the Event Mesh clients watching a product.
 * Role: Tracks stock/watching client ids per product id, and tracks which guest session a
 *   client is reserving under, so stock.changed can be targeted and a guest hold can be
 *   released when that client disconnects.
 * Not in this file: Availability math (src/domain/stock.js) or the reserve/release subscriber
 *   (src/event-mesh/stockHandler.js).
 * Key dependencies: event-mesh/gateway.
 * See also: src/event-mesh/stockHandler.js; src/server.js.
 *   On main this module writes Server-Sent Events; this branch publishes through the gateway.
 */

const STOCK_TOPIC = "stock";
const STOCK_WATCHING_EVENT = "watching";
const STOCK_CHANGED_EVENT = "changed";

/**
 * Creates the stock watcher registry and guest-session tracker used by the mesh handlers.
 *
 * @returns {{
 *   registerWithGateway: () => Promise<void>,
 *   broadcastStockChanged: (productId: string, available: number) => void,
 *   rememberGuestSession: (clientId: string, sessionId: string) => void,
 *   takeGuestSessionForClient: (clientId: string) => string | null,
 *   forgetClient: (clientId: string) => void,
 * }} Watcher registry and publisher.
 */
function createStockEventStream() {
  /** @type {Map<string, Set<string>>} */
  const clientIdsByProductId = new Map();
  /** @type {Map<string, Set<string>>} */
  const productIdsByClientId = new Map();
  /** @type {Map<string, string>} */
  const guestSessionIdByClientId = new Map();

  /**
   * Records that a gateway client should receive this product's stock changes.
   *
   * @param {string} productId - Product the client announced watching.
   * @param {string} clientId - Gateway client id that published stock/watching.
   * @returns {void}
   * @sideEffects Adds the client to both watcher indexes.
   */
  function rememberWatcher(productId, clientId) {
    const existingClientIds = clientIdsByProductId.get(productId);
    const clientIds = existingClientIds || new Set();
    if (!existingClientIds) {
      clientIdsByProductId.set(productId, clientIds);
    }
    clientIds.add(clientId);

    const existingProductIds = productIdsByClientId.get(clientId);
    const productIds = existingProductIds || new Set();
    if (!existingProductIds) {
      productIdsByClientId.set(clientId, productIds);
    }
    productIds.add(productId);
  }

  /**
   * Subscribes to stock/watching and records the sender against the product id it announced.
   *
   * @returns {Promise<void>}
   * @sideEffects Registers a gateway subscriber. Call after gateway.start().
   */
  async function registerWithGateway() {
    const gatewayModule = await import("event-mesh/gateway");
    const gateway = gatewayModule.default;

    gateway.subscribe(STOCK_TOPIC, STOCK_WATCHING_EVENT, (incomingMessage) => {
      const productId = incomingMessage.payload?.productId;
      const clientId = incomingMessage.sourceClientId;
      if (typeof productId !== "string" || !productId || !clientId) {
        return;
      }
      rememberWatcher(productId, clientId);
    });
  }

  /**
   * Publishes one stock change to every client currently watching that product.
   *
   * @param {string} productId - Product whose availability changed.
   * @param {number} available - Recomputed available count.
   * @returns {void}
   * @sideEffects Sends a targeted gateway.publish per watching client.
   */
  function broadcastStockChanged(productId, available) {
    void publishToProductWatchers(productId, available);
  }

  /**
   * Sends stock/changed to each client id currently recorded for the product.
   *
   * @param {string} productId - Product whose availability changed.
   * @param {number} available - Recomputed available count.
   * @returns {Promise<void>}
   * @sideEffects Publishes through the event-mesh gateway.
   */
  async function publishToProductWatchers(productId, available) {
    const clientIds = clientIdsByProductId.get(productId);
    if (!clientIds || clientIds.size === 0) {
      return;
    }
    const gatewayModule = await import("event-mesh/gateway");
    const gateway = gatewayModule.default;
    for (const clientId of clientIds) {
      gateway.publish({
        topic: STOCK_TOPIC,
        event: STOCK_CHANGED_EVENT,
        payload: { productId, available },
        targetClientId: clientId,
      });
    }
  }

  /**
   * Records which guest session a client is reserving or releasing stock under. Watching alone
   * carries no session id — only stock/reserve and stock/release do — so this is set from
   * src/event-mesh/stockHandler.js, not from registerWithGateway above.
   *
   * @param {string} clientId - Gateway client id of the guest connection.
   * @param {string} sessionId - Guest stock session id from the request payload.
   * @returns {void}
   * @sideEffects Replaces any previously remembered session id for that client.
   */
  function rememberGuestSession(clientId, sessionId) {
    guestSessionIdByClientId.set(clientId, sessionId);
  }

  /**
   * Reads and clears the guest session id remembered for a client, for onClientDisconnect to
   * decide whether to release a guest hold.
   *
   * @param {string} clientId - Gateway client id that disconnected.
   * @returns {string | null} The guest session id, or null when the client was signed in or
   *   never reserved as a guest.
   * @sideEffects Removes the entry so a later disconnect of the same client id is a no-op.
   */
  function takeGuestSessionForClient(clientId) {
    const sessionId = guestSessionIdByClientId.get(clientId);
    if (!sessionId) {
      return null;
    }
    guestSessionIdByClientId.delete(clientId);
    return sessionId;
  }

  /**
   * Drops a mesh client from every watcher index.
   *
   * @param {string} clientId - Gateway client id from onClientDisconnect.
   * @returns {void}
   * @sideEffects Removes the id from the product watcher indexes. Does not touch the guest
   *   session map — call takeGuestSessionForClient first if that is still needed.
   */
  function forgetClient(clientId) {
    const productIds = productIdsByClientId.get(clientId);
    if (!productIds) {
      return;
    }
    productIdsByClientId.delete(clientId);
    productIds.forEach((productId) => {
      const clientIds = clientIdsByProductId.get(productId);
      if (!clientIds) {
        return;
      }
      clientIds.delete(clientId);
      if (clientIds.size === 0) {
        clientIdsByProductId.delete(productId);
      }
    });
  }

  return {
    registerWithGateway,
    broadcastStockChanged,
    rememberGuestSession,
    takeGuestSessionForClient,
    forgetClient,
  };
}

module.exports = { createStockEventStream };
