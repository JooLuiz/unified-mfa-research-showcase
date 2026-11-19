/**
 * Verifies checkout asks a guest to sign in and shows the cart when the shopper is signed in.
 * Role: Locks the empty checkout, the checkout sections, and the order-placed confirmation.
 * Not in this file: Stock reservation delivery.
 * Key dependencies: node:test; src/pages/checkoutPage.js; test/support/createPageDocument.js.
 * See also: src/pages/checkoutPage.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import "../../../../test/support/installBrowserGlobals.js";
import {
  createRemoteRecorder,
  installFetch,
  installPageDocument,
  invokeHandler,
  latestRemoteCall,
  resetLocation,
} from "../../../../test/support/createPageDocument.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

const { createPageRoot } = await installPageDocument();
const { renderCheckoutPage, renderOrderPlacedPage } = await loadAppModule(
  new URL("./checkoutPage.js", import.meta.url).href,
);

/**
 * Builds a signed-in shopper with one or more cart lines.
 *
 * @param {object[]} cartItems - Lines currently in the cart.
 * @returns {object} Shell state.
 */
function createShopper(cartItems) {
  return {
    authToken: "token-01",
    currentUser: { id: "user-01", username: "ada" },
    cartItems,
    productsById: {
      mug: { name: "Mug", price: 10 },
      cup: { name: "Cup", price: 4 },
    },
    appliedCoupon: null,
  };
}

test("sends a guest to login", async () => {
  resetLocation("/checkout");
  const pageRoot = createPageRoot();
  await renderCheckoutPage(
    { authToken: "", currentUser: null, cartItems: [] },
    pageRoot,
    createRemoteRecorder(),
    [],
  );
  assert.equal(window.location.pathname, "/login");
});

test("asks an empty cart to go shopping", async () => {
  resetLocation("/checkout");
  const pageRoot = createPageRoot();
  const remotes = createRemoteRecorder();
  await renderCheckoutPage(createShopper([]), pageRoot, remotes, []);
  const emptyCheckout = latestRemoteCall(remotes, "checkoutEmpty");
  assert.equal(emptyCheckout !== undefined, true);
});

test("shows checkout sections and keeps the summary in step with the cart", async () => {
  installFetch(() => ({ ok: false, body: { code: "unavailable" } }));
  resetLocation("/cart");
  const pageRoot = createPageRoot();
  const remotes = createRemoteRecorder();
  const appState = createShopper([
    { productId: "mug", quantity: 1 },
    { productId: "cup", quantity: 1 },
  ]);
  await renderCheckoutPage(appState, pageRoot, remotes, []);

  assert.equal(pageRoot.querySelector("#checkoutItemsMount") !== null, true);
  assert.equal(latestRemoteCall(remotes, "checkoutSummary").props.subtotal, 14);
});

test("confirms an order and continues shopping", async () => {
  resetLocation("/order-placed");
  const pageRoot = createPageRoot();
  await renderOrderPlacedPage(pageRoot);
  assert.match(pageRoot.textContent, /Order Placed/);
  assert.match(pageRoot.textContent, /Thank you for your purchase/);
  pageRoot.querySelector("#continueShoppingButton").click();
  assert.equal(window.location.pathname, "/products");
});
