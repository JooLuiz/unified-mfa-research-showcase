/**
 * Verifies saved-cart reads and the cart left after the session ends.
 * Role: Locks the cart read and local clear outcomes shared by both comparison branches.
 * Not in this file: A guest stock session id.
 * Key dependencies: node:test; src/utils/cartSync.js; test/support/createRecordingTransport.js; test/support/installBrowserGlobals.js.
 * See also: src/utils/cartSync.js; src/commands/cartCommands.js.
 */

import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";
import { createRecordingTransport } from "../../../../test/support/createRecordingTransport.js";
import "../../../../test/support/installBrowserGlobals.js";

const openedCartChannels = [];
globalThis.BroadcastChannel = class RecordingChannel {
  constructor() {
    openedCartChannels.push(this);
  }
  postMessage() {}
};

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
  scheduleCartPersist,
  startCartTabSync,
} = await import("./cartSync.js");
const { startCartLiveEvents } = await import("../events/cartLiveEvents.js");

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

/**
 * Builds a transport whose cart read resolves one saved cart.
 *
 * @param {object} cart - Saved cart body.
 * @returns {ReturnType<typeof createRecordingTransport>} Recording transport.
 */
function transportWithCart(cart) {
  return createRecordingTransport({
    requestReply: { ok: true, cart },
  });
}

test("saved carts and guest merges", async (parentTest) => {
  await parentTest.test("a failed saved-cart read keeps the guest lines, and ending the session clears the cart", async () => {
    const guestLine = { productId: "p-01", quantity: 1 };
    const appState = createCartState([guestLine]);
    const transport = createRecordingTransport({ requestReply: { ok: false } });
    const mergeResult = await mergeGuestCartOnLogin(appState, "token", "u-01", transport);
    assert.deepEqual(mergeResult, { needsPersist: false });
    assert.deepEqual(appState.cartItems, [guestLine]);

    endCartSession(appState);
    assert.deepEqual(appState.cartItems, []);
    assert.equal(appState.appliedCoupon, null);
  });

  await parentTest.test("a shopper who is signed out, or whose saved cart cannot be read, keeps the local cart", async () => {
    const appState = createCartState([{ productId: "local", quantity: 1 }]);
    const transport = createRecordingTransport({ requestReply: { ok: false } });
    await hydrateSavedCart(appState, transport);
    assert.equal(appState.cartItems[0].productId, "local");
    assert.equal(transport.published.length, 0);

    appState.authToken = "token-01";
    await hydrateSavedCart(appState, transport);
    assert.equal(appState.cartItems[0].productId, "local");
  });

  await parentTest.test("an older saved cart does not replace a newer one", async () => {
    const transport = createRecordingTransport({
      requestReplies: [
        {
          ok: true,
          cart: {
            items: [{ productId: "newer", quantity: 1 }],
            appliedCoupon: null,
            updatedAt: "2026-06-01T00:00:00.000Z",
          },
        },
        {
          ok: true,
          cart: {
            items: [{ productId: "older", quantity: 4 }],
            appliedCoupon: null,
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        },
      ],
    });
    const appState = createCartState([], "token-01");
    await hydrateSavedCart(appState, transport);
    assert.equal(appState.cartItems[0].productId, "newer");
    await hydrateSavedCart(appState, transport);
    assert.equal(appState.cartItems[0].productId, "newer");
    assert.equal(appState.cartItems[0].quantity, 1);
  });

  await parentTest.test("a guest with nothing to add adopts the saved cart", async () => {
    const transport = transportWithCart({
      items: [{ productId: "saved", quantity: 2 }],
      appliedCoupon: { code: "SERVER", discountPercentage: 5 },
      updatedAt: "2026-08-01T00:00:00.000Z",
    });
    const appState = createCartState([]);
    const mergeResult = await mergeGuestCartOnLogin(appState, "token-01", "u-01", transport);
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

  await parentTest.test("a live cart is ignored while the shopper is signed out", () => {
    const appState = createCartState([{ productId: "local", quantity: 1 }]);
    const transport = createRecordingTransport();
    startCartTabSync(appState);
    startCartLiveEvents(transport);
    transport.deliver("cart", "live-changed", {
      items: [{ productId: "server", quantity: 3 }],
      appliedCoupon: null,
      updatedAt: "2026-12-01T00:00:00.000Z",
    });
    assert.equal(appState.cartItems[0].productId, "local");
    assert.equal(appState.cartItems[0].quantity, 1);

    appState.authToken = "token-01";
    appState.currentUser = { id: "u-01", fullName: "Ada" };
    const channel = openedCartChannels[0];
    channel.onmessage({
      data: {
        type: "cart-replaced",
        sourceTabId: "other-tab",
        userId: "someone-else",
        items: [{ productId: "ignored", quantity: 9 }],
        appliedCoupon: null,
      },
    });
    assert.equal(appState.cartItems[0].productId, "local");
    channel.onmessage({
      data: {
        type: "cart-replaced",
        sourceTabId: "other-tab",
        userId: "u-01",
        items: [{ productId: "remote", quantity: 2 }],
        appliedCoupon: null,
      },
    });
    assert.equal(appState.cartItems[0].productId, "remote");
  });

  await parentTest.test("a saved cart does not replace the local cart while a save is in progress", async () => {
    const appState = createCartState([{ productId: "local", quantity: 1 }], "token-01");
    const saveTransport = createRecordingTransport({ requestReply: { ok: true } });
    const fetchTransport = createRecordingTransport({
      requestReply: {
        ok: true,
        cart: {
          items: [{ productId: "server", quantity: 9 }],
          appliedCoupon: null,
          updatedAt: "2026-12-01T00:00:00.000Z",
        },
      },
    });
    scheduleCartPersist(appState, saveTransport);
    await hydrateSavedCart(appState, fetchTransport);
    assert.equal(appState.cartItems[0].productId, "local");
    assert.equal(appState.cartItems[0].quantity, 1);
  });

  await parentTest.test("a guest merge that cannot be saved asks the caller to persist again", async () => {
    const transport = createRecordingTransport({
      requestReplies: [
        {
          ok: true,
          cart: { items: [], appliedCoupon: null, updatedAt: "2026-12-02T00:00:00.000Z" },
        },
        { ok: false },
      ],
    });
    const appState = createCartState([{ productId: "guest", quantity: 1 }]);
    const mergeResult = await mergeGuestCartOnLogin(appState, "token-01", "u-01", transport);
    assert.deepEqual(mergeResult, { needsPersist: true });
    assert.equal(appState.cartItems[0].productId, "guest");
  });

});
