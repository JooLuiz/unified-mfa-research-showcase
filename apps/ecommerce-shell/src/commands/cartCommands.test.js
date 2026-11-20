/**
 * Verifies the saved cart is returned, and a failed read leaves the caller without a cart.
 * Role: Locks the fetchSavedCart outcomes shared by both comparison branches.
 * Not in this file: Login merge or cross-tab broadcast.
 * Key dependencies: node:test; src/commands/cartCommands.js; test/support/createRecordingTransport.js; test/support/loadAppModule.js.
 * See also: src/commands/cartCommands.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createRecordingTransport } from "../../../../test/support/createRecordingTransport.js";
import "../../../../test/support/installBrowserGlobals.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

const { fetchSavedCart, saveSavedCart } = await loadAppModule(
  new URL("./cartCommands.js", import.meta.url).href,
);

test("a saved cart is returned, and a failed read leaves the caller without one", async () => {
  const savedCart = { items: [{ productId: "p-01", quantity: 1 }], appliedCoupon: null };
  const loadedTransport = createRecordingTransport({
    requestReply: { ok: true, cart: savedCart },
  });
  const failedTransport = createRecordingTransport({ requestReply: { ok: false } });
  const expectedRequest = {
    topic: "cart",
    event: "fetch",
    payload: { authToken: "token-01" },
  };

  const loaded = await fetchSavedCart(loadedTransport, "token-01");
  assert.equal(loaded.ok, true);
  assert.deepEqual(loaded.cart.items, savedCart.items);
  assert.deepEqual(loadedTransport.published, [expectedRequest]);

  const failed = await fetchSavedCart(failedTransport, "token-01");
  assert.deepEqual(failed, { ok: false });
  assert.deepEqual(failedTransport.published, [expectedRequest]);
});

test("saveSavedCart returns success and records the cart, guest session, and token", async () => {
  const transport = createRecordingTransport({ requestReply: { ok: true } });
  const cartPayload = { items: [{ productId: "p-01", quantity: 2 }], appliedCoupon: null };

  const saved = await saveSavedCart(transport, cartPayload, "guest-01", "token-01");

  assert.deepEqual(saved, { ok: true });
  assert.deepEqual(transport.published, [
    {
      topic: "cart",
      event: "save",
      payload: {
        cart: cartPayload,
        guestStockSessionIdToRelease: "guest-01",
        authToken: "token-01",
      },
    },
  ]);
});
