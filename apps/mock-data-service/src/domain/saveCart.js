/**
 * Saves an authenticated user's cart and notifies that user's watchers.
 * Role: One use case for cart saves: persistence, cart broadcast, and the guest stock hold
 *   release that follows a login merge.
 * Not in this file: Cart validation (src/domain/cartProcessing.js) or how a caller receives
 *   the outcome (HTTP status or gateway reply).
 * Key dependencies: src/domain/cartProcessing.js; src/domain/stock.js.
 * See also: src/routes/cartRoutes.js (PUT /cart).
 */

const { saveCartForUser } = require("./cartProcessing");
const { releaseGuestSession } = require("./stock");

/**
 * Saves one cart.
 *
 * @param {{
 *   jsonStore: object,
 *   userId: string,
 *   payload: { items?: unknown, appliedCoupon?: unknown, requestId?: unknown, guestStockSessionIdToRelease?: unknown } | null | undefined,
 *   streams: {
 *     cart: { broadcastCartChanged: (userId: string, cart: object) => void },
 *     stock: { broadcastStockChanged: (productId: string, available: number) => void },
 *   },
 * }} saveCartInput - Store, caller, cart payload, and broadcasters.
 * @returns {Promise<{ ok: true, result: object } | { ok: false, code: string }>} The saved cart, or a failure code.
 * @sideEffects Writes carts.json; deletes the named guestHolds.json row; broadcasts.
 */
async function saveCart({ jsonStore, userId, payload, streams }) {
  const cartPayload = payload || {};
  const cartResult = await saveCartForUser({ jsonStore, userId, cartPayload });
  if (!cartResult.ok) {
    return cartResult;
  }

  const requestId = typeof cartPayload.requestId === "string" ? cartPayload.requestId : null;
  streams.cart.broadcastCartChanged(userId, {
    ...cartResult.cart,
    ...(requestId ? { requestId } : {}),
  });

  const guestStockSessionIdToRelease = cartPayload.guestStockSessionIdToRelease;
  if (typeof guestStockSessionIdToRelease === "string" && guestStockSessionIdToRelease.trim() !== "") {
    // The login merge already folded this session's guest-held quantities into the saved
    // cart above. Deleting the guestHolds.json row avoids double-counting the same units
    // against `available`. releaseGuestSession reports only the lines it removed, so the
    // broadcast below stays correct whatever the merge did.
    const releaseResult = await releaseGuestSession({
      jsonStore,
      sessionId: guestStockSessionIdToRelease.trim(),
    });
    if (releaseResult.ok) {
      releaseResult.affectedProducts.forEach(({ productId, available }) => {
        streams.stock.broadcastStockChanged(productId, available);
      });
    }
  }

  return { ok: true, result: cartResult.cart };
}

module.exports = { saveCart };
