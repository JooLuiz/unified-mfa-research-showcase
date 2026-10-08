/**
 * Handles authenticated cart saves received through the event-mesh gateway.
 * Role: Persists cart-sync/upsert messages and publishes the stored cart to that user's watchers.
 * Not in this file: HTTP cart reads or the watcher registry (src/infrastructure/cartEventStream.js).
 * Key dependencies: JSON store; src/domain/cartProcessing.js; event-mesh/gateway.
 * See also: src/server.js; src/event-mesh/orderRequestHandler.js.
 */

const {
  saveCartForUser,
} = require("../domain/cartProcessing");

const CART_SYNC_TOPIC = "cart-sync";
const CART_UPSERT_EVENT = "upsert";
const CART_UPSERT_REJECTED_EVENT = "upsert-rejected";

/**
 * Registers the gateway subscriber that processes cart-sync/upsert messages.
 *
 * @param {{ readJsonFileWithDefault: (fileName: string, defaultValue: unknown) => Promise<unknown>, writeJsonFile: (fileName: string, data: unknown) => Promise<void> }} jsonStore - JSON store bound to service data files.
 * @param {{ rememberClient: (userId: string, clientId: string) => void, broadcastCartChanged: (userId: string, cart: object) => void }} cartEventStream - Per-user watcher registry.
 * @returns {Promise<void>}
 * @sideEffects Subscribes to cart upsert events on the local gateway singleton.
 */
async function registerCartUpsertHandler(jsonStore, cartEventStream) {
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

    const requestId = typeof incomingMessage.payload?.requestId === "string"
      ? incomingMessage.payload.requestId
      : null;
    const cartResult = await saveCartForUser({
      jsonStore,
      userId,
      cartPayload: incomingMessage.payload || {},
    });

    if (!cartResult.ok) {
      gateway.reply(incomingMessage, {
        topic: CART_SYNC_TOPIC,
        event: CART_UPSERT_REJECTED_EVENT,
        payload: {
          code: cartResult.code,
          requestId,
        },
      });
      return;
    }

    cartEventStream.broadcastCartChanged(userId, {
      ...cartResult.cart,
      ...(requestId ? { requestId } : {}),
    });
  });
}

module.exports = { registerCartUpsertHandler };
