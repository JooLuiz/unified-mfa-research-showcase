/**
 * Loads and replaces the authenticated cart for the ecommerce shell.
 * Role: Owns the cart HTTP commands so cart sync code only handles the { ok } outcome.
 * Not in this file: Local cart mutation, login merge, or cross-tab broadcast (src/utils/cartSync.js).
 * Key dependencies: Mock data service GET and PUT /api/cart.
 * See also: src/utils/cartSync.js.
 */

import { STOCK_SESSION_RELEASE_HEADER_NAME } from "@shared/stock-events";
import { MOCK_API_BASE_URL } from "../utils/constants";
import fetchJson from "../utils/fetchJson";

/**
 * Loads the signed-in user's saved cart.
 *
 * @param {string} authToken - Bearer token for the current user.
 * @returns {Promise<{ ok: true, cart: { items: object[], appliedCoupon: object | null } } | { ok: false }>} Saved cart, or failure.
 * @sideEffects Performs the HTTP cart read.
 */
async function fetchSavedCart(authToken) {
  try {
    const cart = await fetchJson(`${MOCK_API_BASE_URL}/cart`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
    return { ok: true, cart };
  } catch (error) {
    console.warn("fetchSavedCart - error");
    console.warn(error);
    return { ok: false };
  }
}

/**
 * Replaces the signed-in user's saved cart.
 *
 * @param {string} authToken - Bearer token for the current user.
 * @param {{ items: object[], appliedCoupon: object | null }} cartPayload - Items and coupon to store.
 * @param {string | null} [guestStockSessionIdToRelease] - Guest stock session id whose
 *   guestHolds.json row the server should delete, since this login merge already folded that
 *   session's held quantities into the saved cart. Only the login-merge call site passes this.
 * @returns {Promise<{ ok: boolean }>} Whether the server accepted the cart.
 * @sideEffects Performs the HTTP cart write.
 */
async function saveSavedCart(authToken, cartPayload, guestStockSessionIdToRelease) {
  try {
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    };
    if (guestStockSessionIdToRelease) {
      headers[STOCK_SESSION_RELEASE_HEADER_NAME] = guestStockSessionIdToRelease;
    }
    await fetchJson(`${MOCK_API_BASE_URL}/cart`, {
      method: "PUT",
      headers,
      body: JSON.stringify(cartPayload),
    });
    return { ok: true };
  } catch (error) {
    console.warn("saveSavedCart - error");
    console.warn(error);
    return { ok: false };
  }
}

export { fetchSavedCart, saveSavedCart };
