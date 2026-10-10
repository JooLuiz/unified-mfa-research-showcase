/**
 * Handles authenticated cart saves received through the event-mesh gateway.
 * Role: Persists cart-sync/upsert messages, publishes the stored cart to that user's watchers,
 *   and releases a guest stock hold when the upsert is a login merge.
 * Not in this file: HTTP cart reads or the watcher registry (src/infrastructure/cartEventStream.js).
 * Key dependencies: JSON store; src/domain/cartProcessing.js; src/domain/stock.js; event-mesh/gateway.
 * See also: src/server.js; src/event-mesh/orderRequestHandler.js.
 */

const {
  saveCartForUser,
} = require("../domain/cartProcessing");
const { releaseGuestSession } = require("../domain/stock");

const CART_SYNC_TOPIC = "cart-sync";
const CART_UPSERT_EVENT = "upsert";
const CART_UPSERT_REJECTED_EVENT = "upsert-rejected";

// Payload field the ecommerce shell sets on a login-merge upsert, naming the guest stock
// session whose guestHolds.json row already got folded into the cart items above. Matches
// GUEST_STOCK_SESSION_RELEASE_FIELD in packages/stock-events/src/stockEventsContracts.js.
const GUEST_STOCK_SESSION_RELEASE_FIELD = "guestStockSessionIdToRelease";

/**
 * Registers the gateway subscriber that processes cart-sync/upsert messages.
 *
 * @param {{ readJsonFileWithDefault: (fileName: string, defaultValue: unknown) => Promise<unknown>, writeJsonFile: (fileName: string, data: unknown) => Promise<void> }} jsonStore - JSON store bound to service data files.
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

    const guestStockSessionIdToRelease = incomingMessage.payload?.[GUEST_STOCK_SESSION_RELEASE_FIELD];
    if (typeof guestStockSessionIdToRelease === "string" && guestStockSessionIdToRelease.trim() !== "") {
      // The login merge already folded this session's guest-held quantities into the saved
      // cart above. Deleting the guestHolds.json row here avoids double-counting the same
      // units against `available` on both sides. No stock/changed broadcast for the merged
      // product lines themselves: the hold moved from guest to user, so `available` does not
      // change for them — but releaseGuestSession's affectedProducts still only reports lines
      // that were actually removed, so this stays correct even if the merge logic changes.
      const releaseResult = await releaseGuestSession({
        jsonStore,
        sessionId: guestStockSessionIdToRelease.trim(),
      });
      if (releaseResult.ok) {
        releaseResult.affectedProducts.forEach(({ productId, available }) => {
          stockEventStream.broadcastStockChanged(productId, available);
        });
      }
    }
  });
}

module.exports = { registerCartUpsertHandler };
