/**
 * Verifies checkout totals from the cart and coupon.
 * Role: Locks calculateCheckoutTotals for a coupon and for no coupon.
 * Not in this file: Placing the order. That command uses the branch transport.
 * Key dependencies: node:test; src/commands/placeCheckoutOrder.js; test/support/loadAppModule.js.
 * See also: src/commands/placeCheckoutOrder.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import "../../../../test/support/installBrowserGlobals.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

const { calculateCheckoutTotals } = await loadAppModule(
  new URL("./placeCheckoutOrder.js", import.meta.url).href,
);

/**
 * Builds a cart that includes a known product, a product without a price, and a missing product.
 *
 * @param {object | null} currentUser - Signed-in user, when the checkout has an address.
 * @returns {object} Shell state for checkout.
 */
function createCheckoutState(currentUser) {
  return {
    authToken: "",
    currentUser,
    cartItems: [
      { productId: "mug", quantity: 2 },
      { productId: "poster", quantity: 1 },
      { productId: "missing", quantity: 1 },
    ],
    productsById: {
      mug: { name: "Mug", price: 10 },
      poster: { name: "Poster", price: 0 },
    },
    appliedCoupon: { code: "SAVE10", discountPercentage: 10 },
  };
}

test("checkout totals use the coupon, then drop the discount when the coupon is cleared", () => {
  const appState = createCheckoutState(null);
  const totals = calculateCheckoutTotals(appState);
  assert.equal(totals.subtotal, 20);
  assert.equal(totals.discountAmount, 2);

  appState.appliedCoupon = null;
  const withoutCoupon = calculateCheckoutTotals(appState);
  assert.equal(withoutCoupon.discountAmount, 0);
});
