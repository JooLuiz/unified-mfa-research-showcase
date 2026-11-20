/**
 * Persists checkout orders for the ecommerce shell.
 * Role: Owns the order command so checkout UI code only handles the { ok } outcome.
 * Not in this file: Cart state, toast copy, or post-order navigation (src/commands/placeCheckoutOrder.js).
 * Key dependencies: The shell event interface.
 * See also: src/commands/placeCheckoutOrder.js.
 */

/**
 * Persists an order before checkout clears local cart state.
 *
 * @param {{ request: Function }} transport - Event interface. A missing bearer token returns { ok: false }.
 * @param {object} orderPayload - Order values accepted by the order endpoint.
 * @returns {Promise<{ ok: boolean }>} Whether the server accepted the order.
 * @sideEffects Sends orders/place.
 */
async function placeOrder(transport, orderPayload) {
  return transport.request({
    topic: "orders",
    event: "place",
    payload: orderPayload,
  });
}

export { placeOrder };
