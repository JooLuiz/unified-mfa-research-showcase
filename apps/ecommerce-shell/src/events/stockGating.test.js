/**
 * Verifies startStockGating leaves an untouched cart as it was.
 * Role: Locks the signed-in and empty-guest outcomes shared by both comparison branches.
 * Not in this file: Add-to-cart gating and stock-watch reconnect.
 * Key dependencies: node:test; src/events/stockGating.js; test/support/createRecordingTransport.js; test/support/loadAppModule.js.
 * See also: src/events/stockGating.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createRecordingTransport } from "../../../../test/support/createRecordingTransport.js";
import "../../../../test/support/installBrowserGlobals.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

const { startStockGating } = await loadAppModule(new URL("./stockGating.js", import.meta.url).href);

test("startStockGating leaves a signed-in cart and an empty guest cart unchanged", () => {
  const transport = createRecordingTransport();
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

  startStockGating(signedIn, transport);
  startStockGating(guest, transport);
  assert.deepEqual(signedIn.cartItems, signedInCart);
  assert.deepEqual(guest.cartItems, []);
});
