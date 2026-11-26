/**
 * Handles live-stock reserve and release requests received through the event-mesh gateway.
 * Role: Resolves the caller's holder identity (signed-in user or guest session), calls the
 *   reserveStock / setStockReservation use cases, and replies accepted or rejected.
 * Not in this file: Reservation steps and the availability broadcast (src/domain/reserveStock.js)
 *   or the watcher registry (src/infrastructure/stockEvents.js).
 * Key dependencies: src/domain/reserveStock.js; src/domain/useCaseCodes.js; event-mesh/gateway.
 * See also: src/server.js; src/inbound/cartUpsertHandler.js (same requestId reply shape).
 *   On main the same use cases are called from src/routes/stockRoutes.js.
 */

const { STOCK_REQUEST_INVALID_CODE } = require("../domain/stock");
const { reserveStock, setStockReservation } = require("../domain/reserveStock");
const { STOCK_HOLDER_MISSING_CODE } = require("../domain/useCaseCodes");

const STOCK_TOPIC = "stock";
const STOCK_RESERVE_EVENT = "reserve";
const STOCK_RELEASE_EVENT = "release";
const STOCK_ACCEPTED_EVENT = "accepted";
const STOCK_REJECTED_EVENT = "rejected";

// Reply code the shells already handle for a request with no holder.
const REJECTED_REPLY_CODES = Object.freeze({
  [STOCK_HOLDER_MISSING_CODE]: STOCK_REQUEST_INVALID_CODE,
});

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
   * Shared reserve/release flow: resolve the holder, run the use case, and reply.
   *
   * @param {object} incomingMessage - Gateway message for stock/reserve or stock/release.
   * @param {typeof reserveStock} stockUseCase - reserveStock or setStockReservation.
   * @returns {Promise<void>}
   * @sideEffects Replies to the sender; the use case broadcasts on success.
   */
  async function handleStockRequest(incomingMessage, stockUseCase) {
    const requestId =
      typeof incomingMessage.payload?.requestId === "string" ? incomingMessage.payload.requestId : null;

    const holder = resolveStockHolder(incomingMessage);
    if (holder?.type === "guest" && incomingMessage.sourceClientId) {
      stockEventStream.rememberGuestSession(incomingMessage.sourceClientId, holder.sessionId);
    }

    const stockResult = await stockUseCase({
      jsonStore,
      holder,
      payload: incomingMessage.payload,
      streams: { stock: stockEventStream },
    });

    if (!stockResult.ok) {
      gateway.reply(incomingMessage, {
        topic: STOCK_TOPIC,
        event: STOCK_REJECTED_EVENT,
        payload: { requestId, code: REJECTED_REPLY_CODES[stockResult.code] || stockResult.code },
      });
      return;
    }

    gateway.reply(incomingMessage, {
      topic: STOCK_TOPIC,
      event: STOCK_ACCEPTED_EVENT,
      payload: { requestId, ...stockResult.result },
    });
  }

  gateway.subscribe(STOCK_TOPIC, STOCK_RESERVE_EVENT, (incomingMessage) =>
    handleStockRequest(incomingMessage, reserveStock),
  );
  gateway.subscribe(STOCK_TOPIC, STOCK_RELEASE_EVENT, (incomingMessage) =>
    handleStockRequest(incomingMessage, setStockReservation),
  );
}

module.exports = { registerStockHandler };
