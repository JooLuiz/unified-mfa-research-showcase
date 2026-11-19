/**
 * Verifies startStockGating leaves an untouched cart as it was.
 * Role: Locks the signed-in and empty-guest outcomes shared by both comparison branches.
 * Not in this file: Add-to-cart gating and stock-watch reconnect. Those paths differ by branch and belong in e2e.
 * Key dependencies: node:test; src/events/stockGating.js; test/support/loadAppModule.js.
 * See also: src/events/stockGating.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import "../../../../test/support/installBrowserGlobals.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

const { startStockGating } = await loadAppModule(new URL("./stockGating.js", import.meta.url).href);

test("startStockGating leaves a signed-in cart and an empty guest cart unchanged", () => {
  const originalEventSource = globalThis.EventSource;
  const originalWarn = console.warn;
  console.warn = () => {};
  globalThis.EventSource = class QuietEventSource {
    addEventListener() {}
    close() {}
  };
  const signedInCart = [{ productId: "p-01", quantity: 1 }];
  const signedIn = {
    authToken: "token-01",
    cartItems: signedInCart,
    productsById: { "p-01": { name: "Mug", price: 12 } },
  };
  const guest = {
    authToken: null,
    cartItems: [],
    productsById: {},
  };

  try {
    startStockGating(signedIn);
    startStockGating(guest);
    assert.deepEqual(signedIn.cartItems, signedInCart);
    assert.deepEqual(guest.cartItems, []);
  } finally {
    globalThis.EventSource = originalEventSource;
    console.warn = originalWarn;
  }
});
