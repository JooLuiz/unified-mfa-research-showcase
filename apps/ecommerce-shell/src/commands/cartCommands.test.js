/**
 * Verifies the saved cart is returned, and a failed read leaves the caller without a cart.
 * Role: Locks the fetchSavedCart outcomes shared by both comparison branches.
 * Not in this file: Replacing the saved cart. That write uses the branch transport.
 * Key dependencies: node:test; src/commands/cartCommands.js; test/support/loadAppModule.js.
 * See also: src/commands/cartCommands.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import "../../../../test/support/installBrowserGlobals.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

const { fetchSavedCart } = await loadAppModule(
  new URL("./cartCommands.js", import.meta.url).href,
);

test("a saved cart is returned, and a failed read leaves the caller without one", async () => {
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  console.warn = () => {};
  const savedCart = { items: [{ productId: "p-01", quantity: 1 }], appliedCoupon: null };
  globalThis.fetch = async () => ({ ok: true, json: async () => savedCart });

  try {
    const loaded = await fetchSavedCart("token-01");
    assert.equal(loaded.ok, true);
    assert.deepEqual(loaded.cart.items, savedCart.items);

    globalThis.fetch = async () => {
      throw new Error("offline");
    };
    const failed = await fetchSavedCart("token-01");
    assert.deepEqual(failed, { ok: false });
  } finally {
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
  }
});
