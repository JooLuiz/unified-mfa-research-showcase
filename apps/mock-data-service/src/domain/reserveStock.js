/**
 * Reserves or sets a stock hold for a signed-in user or a guest session.
 * Role: One use case per reservation mode: holder check, stock operation, and the availability
 *   broadcast.
 * Not in this file: Availability math (src/domain/stock.js), holder resolution from headers or
 *   credentials, or how a caller receives the outcome (HTTP status or gateway reply).
 * Key dependencies: src/domain/stock.js; src/domain/useCaseCodes.js.
 * See also: src/routes/stockRoutes.js (POST/PUT /stock/reservations).
 */

const { reserveAdditiveStock, setAbsoluteStock } = require("./stock");
const { STOCK_HOLDER_MISSING_CODE } = require("./useCaseCodes");

/**
 * Runs one stock operation for a holder and broadcasts the new availability.
 *
 * @param {(stockInput: { jsonStore: object, holder: object, productId: unknown, quantity: number }) => Promise<{ ok: true, quantity: number, available: number } | { ok: false, code: string }>} stockOperation - reserveAdditiveStock or setAbsoluteStock.
 * @param {{
 *   jsonStore: object,
 *   holder: { type: "user", userId: string } | { type: "guest", sessionId: string } | null,
 *   payload: { productId?: unknown, quantity?: unknown } | null | undefined,
 *   streams: { stock: { broadcastStockChanged: (productId: string, available: number) => void } },
 * }} stockInput - Store, holder, request, and broadcaster.
 * @returns {Promise<{ ok: true, result: { productId: string, quantity: number, available: number } } | { ok: false, code: string }>} The accepted hold, or a failure code.
 * @sideEffects Writes carts.json or guestHolds.json; broadcasts on success.
 */
async function runStockOperation(stockOperation, { jsonStore, holder, payload, streams }) {
  if (!holder) {
    return { ok: false, code: STOCK_HOLDER_MISSING_CODE };
  }

  const productId = payload?.productId;
  const stockResult = await stockOperation({
    jsonStore,
    holder,
    productId,
    quantity: Number(payload?.quantity),
  });
  if (!stockResult.ok) {
    return stockResult;
  }

  streams.stock.broadcastStockChanged(productId, stockResult.available);
  return {
    ok: true,
    result: { productId, quantity: stockResult.quantity, available: stockResult.available },
  };
}

/**
 * Adds `quantity` to the holder's current hold.
 *
 * @param {Parameters<typeof runStockOperation>[1]} stockInput - See runStockOperation.
 * @returns {ReturnType<typeof runStockOperation>} See runStockOperation.
 */
function reserveStock(stockInput) {
  return runStockOperation(reserveAdditiveStock, stockInput);
}

/**
 * Replaces the holder's current hold with `quantity`.
 *
 * @param {Parameters<typeof runStockOperation>[1]} stockInput - See runStockOperation.
 * @returns {ReturnType<typeof runStockOperation>} See runStockOperation.
 */
function setStockReservation(stockInput) {
  return runStockOperation(setAbsoluteStock, stockInput);
}

module.exports = { reserveStock, setStockReservation };
