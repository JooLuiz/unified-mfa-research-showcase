/**
 * Verifies saved-cart reads and the cart left after the session ends.
 * Role: Locks the cart read and local clear outcomes shared by both comparison branches.
 * Not in this file: A guest merge whose save fails. That save uses the branch transport.
 * Key dependencies: node:test; src/utils/cartSync.js; test/support/installBrowserGlobals.js.
 * See also: src/utils/cartSync.js; src/commands/cartCommands.js.
 */

import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";
import "../../../../test/support/installBrowserGlobals.js";

const extensionlessRegistration = register(
  "../../../../scripts/test/extensionlessResolver.mjs",
  import.meta.url,
);
if (extensionlessRegistration && typeof extensionlessRegistration.then === "function") {
  await extensionlessRegistration;
}

const {
  clearLocalCart,
  endCartSession,
  hydrateSavedCart,
  mergeGuestCartOnLogin,
} = await import("./cartSync.js");

/**
 * Builds shell cart state.
 *
 * @param {object[]} cartItems - Lines already in the cart.
 * @param {string | null} authToken - Signed-in token, or null for a guest.
 * @returns {object} Shell state.
 */
function createCartState(cartItems, authToken = null) {
  return {
    authToken,
    currentUser: authToken ? { id: "u-01", fullName: "Ada" } : null,
    cartItems,
    appliedCoupon: null,
  };
}

test("saved carts and guest merges", async (parentTest) => {
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  console.warn = () => {};

  try {
    await parentTest.test("a failed saved-cart read keeps the guest lines, and ending the session clears the cart", async () => {
      globalThis.fetch = async () => {
        throw new Error("saved cart unavailable");
      };
      const guestLine = { productId: "p-01", quantity: 1 };
      const appState = createCartState([guestLine]);
      const mergeResult = await mergeGuestCartOnLogin(appState, "token", "u-01");
      assert.deepEqual(mergeResult, { needsPersist: false });
      assert.deepEqual(appState.cartItems, [guestLine]);

      endCartSession(appState);
      assert.deepEqual(appState.cartItems, []);
      assert.equal(appState.appliedCoupon, null);
    });

    await parentTest.test("a shopper who is signed out, or whose saved cart cannot be read, keeps the local cart", async () => {
      const appState = createCartState([{ productId: "local", quantity: 1 }]);
      globalThis.fetch = async () => {
        throw new Error("offline");
      };
      await hydrateSavedCart(appState);
      assert.equal(appState.cartItems[0].productId, "local");

      appState.authToken = "token-01";
      await hydrateSavedCart(appState);
      assert.equal(appState.cartItems[0].productId, "local");
    });

    await parentTest.test("an older saved cart does not replace a newer one", async () => {
      const responses = [
        {
          items: [{ productId: "newer", quantity: 1 }],
          appliedCoupon: null,
          updatedAt: "2026-06-01T00:00:00.000Z",
        },
        {
          items: [{ productId: "older", quantity: 4 }],
          appliedCoupon: null,
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ];
      let responseIndex = 0;
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => responses[responseIndex++],
      });
      const appState = createCartState([], "token-01");
      await hydrateSavedCart(appState);
      assert.equal(appState.cartItems[0].productId, "newer");
      await hydrateSavedCart(appState);
      assert.equal(appState.cartItems[0].productId, "newer");
      assert.equal(appState.cartItems[0].quantity, 1);
    });

    await parentTest.test("a guest with nothing to add adopts the saved cart", async () => {
      globalThis.fetch = async () => ({
        ok: true,
        json: async () => ({
          items: [{ productId: "saved", quantity: 2 }],
          appliedCoupon: { code: "SERVER", discountPercentage: 5 },
          updatedAt: "2026-08-01T00:00:00.000Z",
        }),
      });
      const appState = createCartState([]);
      const mergeResult = await mergeGuestCartOnLogin(appState, "token-01", "u-01");
      assert.deepEqual(mergeResult, { needsPersist: false });
      assert.deepEqual(appState.cartItems, [{ productId: "saved", quantity: 2 }]);
      assert.equal(appState.appliedCoupon.code, "SERVER");
    });

    await parentTest.test("clearing the local cart removes every line", () => {
      const appState = createCartState([{ productId: "mug", quantity: 1 }], "token-01");
      clearLocalCart(appState);
      assert.deepEqual(appState.cartItems, []);
      assert.equal(appState.appliedCoupon, null);
    });
  } finally {
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
  }
});
