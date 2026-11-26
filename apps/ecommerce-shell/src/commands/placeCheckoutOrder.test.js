/**
 * Verifies checkout totals, the cart outcome, and the route after the order command replies.
 * Role: Locks calculateCheckoutTotals, and the cleared or kept cart and route after an accepted or rejected order.
 * Not in this file: The failed-order toast (src/pages/checkoutPage.js).
 * Key dependencies: node:test; src/commands/placeCheckoutOrder.js; test/support/loadAppModule.js;
 *   test/support/createRecordingTransport.js.
 * See also: src/commands/placeCheckoutOrder.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import "../../../../test/support/installBrowserGlobals.js";
import { createRecordingTransport } from "../../../../test/support/createRecordingTransport.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

const { calculateCheckoutTotals, placeCheckoutOrder } = await loadAppModule(
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

test("an accepted order sends the checkout totals and empties the cart", async () => {
  window.location.pathname = "/checkout";
  const appState = createCheckoutState({ id: "user-01", address: "1 Main St" });
  const transport = createRecordingTransport({ requestReply: { ok: true } });

  const orderResult = await placeCheckoutOrder(transport, appState);

  assert.deepEqual(orderResult, { ok: true });
  assert.equal(transport.published.length, 1);
  assert.equal(transport.published[0].payload.totalAmount, 18);
  assert.equal(transport.published[0].payload.shippingAddress, "1 Main St");
  assert.deepEqual(appState.cartItems, []);
  assert.equal(appState.appliedCoupon, null);
  assert.equal(window.location.pathname, "/order-placed");
});

test("a rejected order keeps the cart, the coupon, and the checkout route", async () => {
  window.location.pathname = "/checkout";
  const appState = createCheckoutState(null);
  const transport = createRecordingTransport({ requestReply: { ok: false } });

  const orderResult = await placeCheckoutOrder(transport, appState);

  assert.deepEqual(orderResult, { ok: false });
  assert.equal(appState.cartItems.length, 3);
  assert.equal(appState.appliedCoupon.code, "SAVE10");
  assert.equal(window.location.pathname, "/checkout");
});
