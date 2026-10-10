/**
 * Handles live-stock reserve and release requests received through the event-mesh gateway.
 * Role: Resolves the caller's holder identity (signed-in user or guest session), calls
 *   src/domain/stock.js, replies accepted or rejected, and broadcasts the resulting
 *   availability to every watcher through src/infrastructure/stockEventStream.js.
 * Not in this file: Availability math (src/domain/stock.js) or the watcher registry
 *   (src/infrastructure/stockEventStream.js).
 * Key dependencies: src/domain/stock.js; src/infrastructure/stockEventStream.js; event-mesh/gateway.
 * See also: src/server.js; src/event-mesh/cartUpsertHandler.js (same requestId reply shape).
 */

const {
  STOCK_REQUEST_INVALID_CODE,
  reserveAdditiveStock,
  setAbsoluteStock,
} = require("../domain/stock");

const STOCK_TOPIC = "stock";
const STOCK_RESERVE_EVENT = "reserve";
const STOCK_RELEASE_EVENT = "release";
const STOCK_ACCEPTED_EVENT = "accepted";
const STOCK_REJECTED_EVENT = "rejected";

/**
 * Resolves the caller's stock holder identity from the mesh credential and payload. A
 * signed-in caller is the mesh credential's userId; the payload's sessionId is ignored. A
 * guest caller (no credential userId) is identified by the payload's sessionId.
 *
 * @param {{ credential?: { userId?: string }, payload?: { sessionId?: string } }} incomingMessage - Mesh message.
 * @returns {{ type: "user", userId: string } | { type: "guest", sessionId: string } | null} Holder identity, or null when a guest sent no session id.
 */
function resolveStockHolder(incomingMessage) {
  const userId = incomingMessage.credential?.userId;
  if (userId) {
    return { type: "user", userId };
  }
  const sessionId = incomingMessage.payload?.sessionId;
  if (typeof sessionId === "string" && sessionId.trim() !== "") {
    return { type: "guest", sessionId: sessionId.trim() };
  }
  return null;
}

/**
 * Registers the gateway subscribers that process stock/reserve and stock/release messages.
 *
 * @param {object} jsonStore - JSON store bound to service data files.
 * @param {{ broadcastStockChanged: (productId: string, available: number) => void, rememberGuestSession: (clientId: string, sessionId: string) => void }} stockEventStream - Watcher registry and publisher.
 * @returns {Promise<void>}
 * @sideEffects Subscribes to stock request events on the local gateway singleton.
 */
async function registerStockHandler(jsonStore, stockEventStream) {
  const gatewayModule = await import("event-mesh/gateway");
  const gateway = gatewayModule.default;

  /**
   * Shared reserve/release flow: resolve the holder, run the stock operation, and reply or
   * broadcast depending on the outcome.
   *
   * @param {object} incomingMessage - Gateway message for stock/reserve or stock/release.
   * @param {(stockInput: { jsonStore: object, holder: object, productId: string, quantity: number }) => Promise<{ ok: boolean, code?: string, quantity?: number, available?: number }>} stockOperation - reserveAdditiveStock or setAbsoluteStock.
   * @returns {Promise<void>}
   * @sideEffects Replies to the sender and, on success, broadcasts stock/changed.
   */
  async function handleStockRequest(incomingMessage, stockOperation) {
    const requestId =
      typeof incomingMessage.payload?.requestId === "string" ? incomingMessage.payload.requestId : null;
    const productId = incomingMessage.payload?.productId;
    const quantity = Number(incomingMessage.payload?.quantity);

    const holder = resolveStockHolder(incomingMessage);
    if (!holder) {
      gateway.reply(incomingMessage, {
        topic: STOCK_TOPIC,
        event: STOCK_REJECTED_EVENT,
        payload: { requestId, code: STOCK_REQUEST_INVALID_CODE },
      });
      return;
    }

    if (holder.type === "guest" && incomingMessage.sourceClientId) {
      stockEventStream.rememberGuestSession(incomingMessage.sourceClientId, holder.sessionId);
    }

    const stockResult = await stockOperation({ jsonStore, holder, productId, quantity });

    if (!stockResult.ok) {
      gateway.reply(incomingMessage, {
        topic: STOCK_TOPIC,
        event: STOCK_REJECTED_EVENT,
        payload: { requestId, code: stockResult.code },
      });
      return;
    }

    gateway.reply(incomingMessage, {
      topic: STOCK_TOPIC,
      event: STOCK_ACCEPTED_EVENT,
      payload: {
        requestId,
        productId,
        quantity: stockResult.quantity,
        available: stockResult.available,
      },
    });
    stockEventStream.broadcastStockChanged(productId, stockResult.available);
  }

  gateway.subscribe(STOCK_TOPIC, STOCK_RESERVE_EVENT, (incomingMessage) =>
    handleStockRequest(incomingMessage, reserveAdditiveStock),
  );
  gateway.subscribe(STOCK_TOPIC, STOCK_RELEASE_EVENT, (incomingMessage) =>
    handleStockRequest(incomingMessage, setAbsoluteStock),
  );
}

module.exports = { registerStockHandler };
