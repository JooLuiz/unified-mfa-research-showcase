/**
 * Handles authenticated cart saves received through the event-mesh gateway.
 * Role: Adapts cart-sync/upsert messages to the saveCart use case and rejects invalid saves.
 * Not in this file: Save, broadcast, and guest-hold release steps (src/domain/saveCart.js), HTTP
 *   cart reads, or the watcher registry (src/infrastructure/cartEvents.js).
 * Key dependencies: src/domain/saveCart.js; event-mesh/gateway.
 * See also: src/server.js; src/inbound/orderRequestHandler.js.
 *   On main the same use case is called from src/routes/cartRoutes.js (PUT /cart).
 */

const { saveCart } = require("../domain/saveCart");

const CART_SYNC_TOPIC = "cart-sync";
const CART_UPSERT_EVENT = "upsert";
const CART_UPSERT_REJECTED_EVENT = "upsert-rejected";

/**
 * Registers the gateway subscriber that processes cart-sync/upsert messages.
 *
 * The payload's `guestStockSessionIdToRelease` (set by the ecommerce shell on a login merge,
 * see packages/stock-events/src/stockEventsContracts.js) is read by saveCart.
 *
 * @param {object} jsonStore - JSON store bound to service data files.
 * @param {{ rememberClient: (userId: string, clientId: string) => void, broadcastCartChanged: (userId: string, cart: object) => void }} cartEventStream - Per-user watcher registry.
 * @param {{ broadcastStockChanged: (productId: string, available: number) => void }} stockEventStream - Notifies stock watchers when a login merge releases a guest hold.
 * @returns {Promise<void>}
 * @sideEffects Subscribes to cart upsert events on the local gateway singleton.
 */
async function registerCartUpsertHandler(jsonStore, cartEventStream, stockEventStream) {
  const gatewayModule = await import("event-mesh/gateway");
  const gateway = gatewayModule.default;

  gateway.subscribe(CART_SYNC_TOPIC, CART_UPSERT_EVENT, async (incomingMessage) => {
    const userId = incomingMessage.credential?.userId;
    if (!userId) {
      return;
    }

    if (incomingMessage.sourceClientId) {
      cartEventStream.rememberClient(userId, incomingMessage.sourceClientId);
    }

    const cartResult = await saveCart({
      jsonStore,
      userId,
      payload: incomingMessage.payload,
      streams: { cart: cartEventStream, stock: stockEventStream },
    });

    if (!cartResult.ok) {
      const requestId = typeof incomingMessage.payload?.requestId === "string"
        ? incomingMessage.payload.requestId
        : null;
      gateway.reply(incomingMessage, {
        topic: CART_SYNC_TOPIC,
        event: CART_UPSERT_REJECTED_EVENT,
        payload: { code: cartResult.code, requestId },
      });
    }
  });
}

module.exports = { registerCartUpsertHandler };
