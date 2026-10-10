/**
 * Serves live-stock routes for the mock data service.
 * Role: Handles POST/PUT /stock/reservations, GET /stock/stream, and PUT /stock/watching,
 *   mounted at /api.
 * Not in this file: Availability math (src/domain/stock.js) or the SSE watcher registry
 *   (src/infrastructure/stockEventStream.js).
 * Key dependencies: src/domain/stock.js; src/domain/auth.js; src/domain/identifiers.js;
 *   src/infrastructure/stockEventStream.js.
 * See also: src/server.js; src/routes/cartRoutes.js (guest-hold release on login merge);
 *   src/routes/orderRoutes.js (broadcast after a sale).
 */

const express = require("express");
const { extractUserIdFromToken } = require("../domain/auth");
const { generateIdentifier } = require("../domain/identifiers");
const {
  STOCK_INSUFFICIENT_CODE,
  reserveAdditiveStock,
  setAbsoluteStock,
  releaseGuestSession,
} = require("../domain/stock");

const STOCK_SESSION_HEADER_NAME = "x-stock-session";
const STOCK_STREAM_HEARTBEAT_INTERVAL_MS = 20_000;

/**
 * Resolves the caller's stock holder identity for a reservation request.
 *
 * @param {import("express").Request} request - Incoming request.
 * @returns {{ type: "user", userId: string } | { type: "guest", sessionId: string } | null} Holder identity, or null when neither an Authorization bearer nor an X-Stock-Session header is present.
 */
function resolveStockHolder(request) {
  const userId = extractUserIdFromToken(request.headers.authorization);
  if (userId) {
    return { type: "user", userId };
  }
  const sessionIdHeader = request.headers[STOCK_SESSION_HEADER_NAME];
  if (typeof sessionIdHeader === "string" && sessionIdHeader.trim() !== "") {
    return { type: "guest", sessionId: sessionIdHeader.trim() };
  }
  return null;
}

/**
 * Writes the shared accept/reject response shape for both reservation endpoints.
 *
 * @param {import("express").Response} response - Express response.
 * @param {string} productId - Product from the request body.
 * @param {{ ok: true, quantity: number, available: number } | { ok: false, code: string }} stockResult - Outcome from reserveAdditiveStock or setAbsoluteStock.
 * @param {{ broadcastStockChanged: (productId: string, available: number) => void }} stockEventStream - Broadcaster notified on acceptance.
 * @returns {void}
 * @sideEffects Broadcasts stock_changed on acceptance.
 */
function respondWithStockResult(response, productId, stockResult, stockEventStream) {
  if (!stockResult.ok) {
    if (stockResult.code === STOCK_INSUFFICIENT_CODE) {
      response.status(409).json({ code: STOCK_INSUFFICIENT_CODE });
      return;
    }
    response.status(400).json({ message: "Invalid stock request", code: stockResult.code });
    return;
  }
  stockEventStream.broadcastStockChanged(productId, stockResult.available);
  response.json({ productId, quantity: stockResult.quantity, available: stockResult.available });
}

/**
 * Creates the stock router.
 *
 * @param {object} jsonStore - JSON file store bound to the data directory.
 * @param {{ registerStream: Function, removeStream: Function, setWatchedProductIds: Function, writeStreamReady: Function, broadcastStockChanged: Function }} stockEventStream - Per-tab stock SSE broadcaster.
 * @returns {import("express").Router} Router with the stock HTTP routes and the live stock stream.
 */
function createStockRouter(jsonStore, stockEventStream) {
  const router = express.Router();

  router.post("/stock/reservations", async (request, response) => {
    try {
      const holder = resolveStockHolder(request);
      if (!holder) {
        response.status(401).json({ message: "Missing stock credential" });
        return;
      }
      const { productId, quantity } = request.body || {};
      const reserveResult = await reserveAdditiveStock({
        jsonStore,
        holder,
        productId,
        quantity: Number(quantity),
      });
      respondWithStockResult(response, productId, reserveResult, stockEventStream);
    } catch (error) {
      response.status(500).json({ message: "Unable to reserve stock", details: error.message });
    }
  });

  router.put("/stock/reservations", async (request, response) => {
    try {
      const holder = resolveStockHolder(request);
      if (!holder) {
        response.status(401).json({ message: "Missing stock credential" });
        return;
      }
      const { productId, quantity } = request.body || {};
      const setResult = await setAbsoluteStock({
        jsonStore,
        holder,
        productId,
        quantity: Number(quantity),
      });
      respondWithStockResult(response, productId, setResult, stockEventStream);
    } catch (error) {
      response.status(500).json({ message: "Unable to update stock reservation", details: error.message });
    }
  });

  /**
   * GET /stock/stream. The one shared SSE connection per tab, always identified by the guest
   * session id in the query string (watching never requires the shopper's real identity — see
   * the "Architecture decisions" note in the implementation plan). First frame is
   * stock_stream_ready with the id the client must echo on PUT /stock/watching. On close,
   * releases that session's guest holds, if any, and broadcasts the result.
   */
  router.get("/stock/stream", (request, response) => {
    const sessionId =
      typeof request.query.sessionId === "string" ? request.query.sessionId.trim() : "";
    if (!sessionId) {
      response.status(400).json({ message: "Missing sessionId" });
      return;
    }

    response.setHeader("Content-Type", "text/event-stream");
    response.setHeader("Cache-Control", "no-cache");
    response.setHeader("Connection", "keep-alive");
    response.flushHeaders();

    const streamId = generateIdentifier("stock-stream");
    stockEventStream.registerStream(streamId, response);
    stockEventStream.writeStreamReady(response, streamId);

    const heartbeatIntervalId = setInterval(() => {
      response.write(": ping\n\n");
    }, STOCK_STREAM_HEARTBEAT_INTERVAL_MS);

    response.on("close", () => {
      clearInterval(heartbeatIntervalId);
      stockEventStream.removeStream(streamId);
      releaseGuestSession({ jsonStore, sessionId })
        .then((releaseResult) => {
          if (!releaseResult.ok) {
            return;
          }
          releaseResult.affectedProducts.forEach(({ productId, available }) => {
            stockEventStream.broadcastStockChanged(productId, available);
          });
        })
        .catch((error) => {
          console.error("GET /stock/stream - close - error");
          console.error(error);
        });
    });
  });

  /**
   * PUT /stock/watching. Replaces the set of product ids one open stream cares about.
   * No-ops silently when the streamId is unknown (the connection may have just closed).
   */
  router.put("/stock/watching", (request, response) => {
    const { streamId, productIds } = request.body || {};
    if (typeof streamId !== "string" || !streamId) {
      response.status(400).json({ message: "Missing streamId" });
      return;
    }
    stockEventStream.setWatchedProductIds(streamId, productIds);
    response.json({ ok: true });
  });

  return router;
}

module.exports = { createStockRouter };
