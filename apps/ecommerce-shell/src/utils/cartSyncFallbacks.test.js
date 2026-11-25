/**
 * Verifies saved carts without a version and a local clear without a user record.
 * Role: Locks which saved cart a tab keeps when the server cart has no updatedAt, and the
 *   cart other tabs are told about after a clear with no current user.
 * Not in this file: Guest merges and tab messages (see cartSync.test.js).
 * Key dependencies: node:test; src/utils/cartSync.js; test/support/createRecordingTransport.js; test/support/installBrowserGlobals.js.
 * See also: src/utils/cartSync.test.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createRecordingTransport } from "../../../../test/support/createRecordingTransport.js";
import "../../../../test/support/installBrowserGlobals.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

const postedCartMessages = [];
globalThis.BroadcastChannel = class RecordingChannel {
  postMessage(message) {
    postedCartMessages.push(message);
  }
};

const { clearLocalCart, hydrateSavedCart, startCartTabSync } = await loadAppModule(
  new URL("./cartSync.js", import.meta.url).href,
);

/**
 * Builds signed-in shell cart state.
 *
 * @param {object[]} cartItems - Lines already in the cart.
 * @returns {object} Shell state.
 */
function createSignedInCart(cartItems) {
  return { authToken: "token-01", currentUser: { id: "u-01" }, cartItems, appliedCoupon: null };
}

test("a saved cart without a version applies first and is ignored once a versioned cart is kept", async () => {
  const transport = createRecordingTransport({
    requestReplies: [
      { ok: true, cart: { items: [{ productId: "unversioned", quantity: 1 }], appliedCoupon: null } },
      {
        ok: true,
        cart: {
          items: [{ productId: "versioned", quantity: 2 }],
          appliedCoupon: null,
          updatedAt: "2026-02-01T00:00:00.000Z",
        },
      },
      { ok: true, cart: { items: [{ productId: "late-unversioned", quantity: 3 }], appliedCoupon: null } },
    ],
  });
  const appState = createSignedInCart([]);

  await hydrateSavedCart(appState, transport);
  assert.deepEqual(appState.cartItems, [{ productId: "unversioned", quantity: 1 }]);

  await hydrateSavedCart(appState, transport);
  assert.deepEqual(appState.cartItems, [{ productId: "versioned", quantity: 2 }]);

  await hydrateSavedCart(appState, transport);
  assert.deepEqual(appState.cartItems, [{ productId: "versioned", quantity: 2 }]);
});

test("clearing a cart with no current user empties it and tells other tabs about no user", () => {
  const appState = { ...createSignedInCart([{ productId: "mug", quantity: 1 }]), currentUser: null };
  startCartTabSync(appState);

  clearLocalCart(appState);

  assert.deepEqual(appState.cartItems, []);
  const lastMessage = postedCartMessages.at(-1);
  assert.equal(lastMessage.type, "cart-replaced");
  assert.equal(lastMessage.userId, null);
  assert.deepEqual(lastMessage.items, []);
});
