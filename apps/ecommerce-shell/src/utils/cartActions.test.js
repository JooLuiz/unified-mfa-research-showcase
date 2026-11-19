/**
 * Verifies cart totals and local line edits.
 * Role: Locks the cart math and in-memory edits both comparison branches share.
 * Not in this file: A stock reservation. That command uses the branch transport.
 * Key dependencies: node:test; src/utils/cartActions.js; test/support/loadAppModule.js.
 * See also: src/utils/cartActions.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import "../../../../test/support/installBrowserGlobals.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

const {
  addCartItem,
  calculateCartTotals,
  getCartDiscountedTotal,
  getCartItemCount,
  getCartTotalValue,
  removeCartItem,
  updateCartItem,
} = await loadAppModule(new URL("./cartActions.js", import.meta.url).href);

/**
 * Builds shell cart state for one test.
 *
 * @param {object[]} cartItems - Lines already in the cart.
 * @param {string | null} authToken - Signed-in token, or null for a guest.
 * @returns {object} Shell state.
 */
function createCartState(cartItems, authToken = null) {
  return {
    authToken,
    cartItems,
    productsById: { mug: { name: "Mug", price: 10 } },
    appliedCoupon: { discountPercentage: 25 },
    currentUser: null,
  };
}

test("cart totals skip a missing product and apply the coupon", () => {
  const appState = createCartState([
    { productId: "mug", quantity: 2 },
    { productId: "gone", quantity: 4 },
  ]);

  assert.equal(getCartTotalValue(appState), 20);
  assert.equal(getCartItemCount(appState), 6);
  const totals = calculateCartTotals(appState);
  assert.equal(totals.subtotal, 20);
  assert.equal(totals.discountAmount, 5);
  assert.equal(totals.totalAmount, 15);
  assert.equal(getCartDiscountedTotal(appState), 15);

  appState.appliedCoupon = null;
  assert.equal(calculateCartTotals(appState).discountAmount, 0);
  assert.equal(calculateCartTotals(appState).totalAmount, 20);
});

test("local cart edits add, replace, and remove lines", () => {
  const appState = createCartState([]);

  addCartItem(appState, "mug", Number.NaN);
  assert.deepEqual(appState.cartItems, [{ productId: "mug", quantity: 1 }]);

  addCartItem(appState, "mug", 2);
  assert.equal(appState.cartItems[0].quantity, 3);

  updateCartItem(appState, "poster", 4);
  assert.equal(appState.cartItems[1].quantity, 4);
  updateCartItem(appState, "poster", 1);
  assert.equal(appState.cartItems[1].quantity, 1);

  removeCartItem(appState, "mug");
  assert.deepEqual(appState.cartItems, [{ productId: "poster", quantity: 1 }]);
});
