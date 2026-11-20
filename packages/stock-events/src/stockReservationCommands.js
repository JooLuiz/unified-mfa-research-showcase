/**
 * Stock hold commands.
 * Role: Reserves or sets a hold through the injected transport.
 * Not in this file: Live availability (src/createStockWatchClient.js) or guest session id creation.
 * Key dependencies: The caller supplies the transport.
 * See also: apps/ecommerce-shell/src/utils/cartActions.js.
 */

/**
 * Adds a quantity to the caller's hold for one product.
 *
 * @param {{ request: Function }} transport - Event interface.
 * @param {{ productId: string, quantity: number, sessionId?: string | null }} reserveInput - Product, quantity to add, and the guest session id when the shopper is signed out.
 * @returns {Promise<{ ok: true, quantity: number, available: number } | { ok: false, code: string }>} Server outcome.
 * @sideEffects Sends stock/reserve.
 */
function reserveStockQuantity(transport, { productId, quantity, sessionId }) {
  return transport.request({
    topic: "stock",
    event: "reserve",
    payload: { productId, quantity, sessionId: sessionId || "" },
  });
}

/**
 * Sets the caller's hold for one product to an absolute quantity. 0 removes the line.
 *
 * @param {{ request: Function }} transport - Event interface.
 * @param {{ productId: string, quantity: number, sessionId?: string | null }} setInput - Product, next absolute quantity, and the guest session id when the shopper is signed out.
 * @returns {Promise<{ ok: true, quantity: number, available: number } | { ok: false, code: string }>} Server outcome.
 * @sideEffects Sends stock/set.
 */
function setStockQuantity(transport, { productId, quantity, sessionId }) {
  return transport.request({
    topic: "stock",
    event: "set",
    payload: { productId, quantity, sessionId: sessionId || "" },
  });
}

export { reserveStockQuantity, setStockQuantity };
