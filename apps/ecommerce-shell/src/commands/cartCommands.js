/**
 * Loads and replaces the authenticated cart for the ecommerce shell.
 * Role: Owns the cart commands so cart sync code only handles the { ok } outcome.
 * Not in this file: Local cart mutation, login merge, or cross-tab broadcast (src/utils/cartSync.js).
 * Key dependencies: The shell event interface.
 * See also: src/utils/cartSync.js; src/events/eventEndpoints.js.
 */

/**
 * Loads the signed-in user's saved cart.
 *
 * @param {{ request: Function }} transport - Event interface.
 * @param {string} [authToken] - Token to send when it is not yet the adapter's live session token.
 * @returns {Promise<{ ok: true, cart: { items: object[], appliedCoupon: object | null } } | { ok: false }>} Saved cart, or failure.
 * @sideEffects Sends cart/fetch.
 */
async function fetchSavedCart(transport, authToken = "") {
  return transport.request({ topic: "cart", event: "fetch", payload: { authToken } });
}

/**
 * Replaces the signed-in user's saved cart.
 *
 * @param {{ request: Function }} transport - Event interface.
 * @param {{ items: object[], appliedCoupon: object | null }} cartPayload - Items and coupon to store.
 * @param {string | null} [guestStockSessionIdToRelease] - Guest stock session id whose hold row the server should delete.
 * @param {string} [authToken] - Token captured when the save was queued, used when the live session has not caught up.
 * @returns {Promise<{ ok: boolean }>} Whether the server accepted the cart.
 * @sideEffects Sends cart/save.
 */
async function saveSavedCart(transport, cartPayload, guestStockSessionIdToRelease, authToken = "") {
  return transport.request({
    topic: "cart",
    event: "save",
    payload: {
      cart: cartPayload,
      guestStockSessionIdToRelease: guestStockSessionIdToRelease || "",
      authToken,
    },
  });
}

export { fetchSavedCart, saveSavedCart };
