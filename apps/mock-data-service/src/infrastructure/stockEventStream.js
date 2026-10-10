/**
 * Pushes live availability pushes to every browser tab watching a product.
 * Role: Owns the in-memory map of open stock SSE responses, keyed by a server-issued stream id,
 *   and the reverse index of which streams are watching which product ids.
 * Not in this file: Availability math (src/domain/stock.js) or ticket/session resolution
 *   (src/routes/stockRoutes.js).
 * Key dependencies: None (pure Node response writes).
 * See also: src/routes/stockRoutes.js.
 */

const STOCK_CHANGED_EVENT_NAME = "stock_changed";
const STOCK_STREAM_READY_EVENT_NAME = "stock_stream_ready";

/**
 * Formats the first frame a connecting stream receives, carrying the id it must echo back on
 * every PUT /stock/watching call.
 *
 * @param {string} streamId - Server-issued id for this connection.
 * @returns {string} SSE frame.
 */
function serializeStreamReady(streamId) {
  return `event: ${STOCK_STREAM_READY_EVENT_NAME}\ndata: ${JSON.stringify({ streamId })}\n\n`;
}

/**
 * Formats one stock_changed Server-Sent Event.
 *
 * @param {string} productId - Product whose availability changed.
 * @param {number} available - Recomputed available count.
 * @returns {string} SSE frame.
 */
function serializeStockChanged(productId, available) {
  return `event: ${STOCK_CHANGED_EVENT_NAME}\ndata: ${JSON.stringify({ productId, available })}\n\n`;
}

/**
 * Creates the stock SSE watcher registry.
 *
 * @returns {{
 *   registerStream: (streamId: string, response: import("express").Response) => void,
 *   removeStream: (streamId: string) => void,
 *   setWatchedProductIds: (streamId: string, productIds: unknown) => void,
 *   writeStreamReady: (response: import("express").Response, streamId: string) => void,
 *   broadcastStockChanged: (productId: string, available: number) => void,
 * }} Stream bound to in-memory maps.
 */
function createStockEventStream() {
  /** @type {Map<string, import("express").Response>} */
  const responseByStreamId = new Map();
  /** @type {Map<string, Set<string>>} */
  const watchedProductIdsByStreamId = new Map();
  /** @type {Map<string, Set<string>>} */
  const streamIdsByProductId = new Map();

  function forgetWatchedProductIds(streamId) {
    const previousProductIds = watchedProductIdsByStreamId.get(streamId);
    if (!previousProductIds) {
      return;
    }
    previousProductIds.forEach((productId) => {
      const streamIds = streamIdsByProductId.get(productId);
      if (!streamIds) {
        return;
      }
      streamIds.delete(streamId);
      if (streamIds.size === 0) {
        streamIdsByProductId.delete(productId);
      }
    });
    watchedProductIdsByStreamId.delete(streamId);
  }

  /**
   * Registers an open SSE response under its server-issued stream id.
   *
   * @param {string} streamId - Id issued for this connection.
   * @param {import("express").Response} response - Open, header-flushed SSE response.
   * @returns {void}
   * @sideEffects Adds the response to the registry.
   */
  function registerStream(streamId, response) {
    responseByStreamId.set(streamId, response);
  }

  /**
   * Removes a stream and every product id it was watching.
   *
   * @param {string} streamId - Id of the connection that closed.
   * @returns {void}
   * @sideEffects Deletes the response and clears the reverse watch index.
   */
  function removeStream(streamId) {
    forgetWatchedProductIds(streamId);
    responseByStreamId.delete(streamId);
  }

  /**
   * Replaces the set of product ids one stream is watching.
   *
   * @param {string} streamId - Id from the stream's stock_stream_ready frame.
   * @param {unknown} productIds - Candidate product id list from PUT /stock/watching.
   * @returns {void}
   * @sideEffects No-ops when the stream is unknown (it may have just closed).
   */
  function setWatchedProductIds(streamId, productIds) {
    if (!responseByStreamId.has(streamId)) {
      return;
    }
    forgetWatchedProductIds(streamId);
    const nextProductIds = new Set(
      Array.isArray(productIds) ? productIds.filter((productId) => typeof productId === "string") : [],
    );
    watchedProductIdsByStreamId.set(streamId, nextProductIds);
    nextProductIds.forEach((productId) => {
      const streamIds = streamIdsByProductId.get(productId) || new Set();
      streamIds.add(streamId);
      streamIdsByProductId.set(productId, streamIds);
    });
  }

  /**
   * Writes the stream-ready handshake frame to a newly opened connection.
   *
   * @param {import("express").Response} response - The connection that just registered.
   * @param {string} streamId - Id the client must echo back on PUT /stock/watching.
   * @returns {void}
   * @sideEffects Writes one SSE frame.
   */
  function writeStreamReady(response, streamId) {
    response.write(serializeStreamReady(streamId));
  }

  /**
   * Writes a stock change to every stream currently watching that product.
   *
   * @param {string} productId - Product whose availability changed.
   * @param {number} available - Recomputed available count.
   * @returns {void}
   * @sideEffects Writes to every open stream watching that product id.
   */
  function broadcastStockChanged(productId, available) {
    const streamIds = streamIdsByProductId.get(productId);
    if (!streamIds) {
      return;
    }
    const serializedMessage = serializeStockChanged(productId, available);
    streamIds.forEach((streamId) => {
      const response = responseByStreamId.get(streamId);
      if (response) {
        response.write(serializedMessage);
      }
    });
  }

  return {
    registerStream,
    removeStream,
    setWatchedProductIds,
    writeStreamReady,
    broadcastStockChanged,
  };
}

module.exports = {
  STOCK_CHANGED_EVENT_NAME,
  STOCK_STREAM_READY_EVENT_NAME,
  createStockEventStream,
};
