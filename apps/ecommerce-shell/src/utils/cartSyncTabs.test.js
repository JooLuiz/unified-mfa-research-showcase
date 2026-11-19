/**
 * Verifies carts pushed from another tab and a logout noticed from shared storage.
 * Role: Locks the cart left in this tab after a remote notice or a removed auth token.
 * Not in this file: Opening the live connection.
 * Key dependencies: node:test; src/utils/cartSync.js; test/support/installBrowserGlobals.js.
 * See also: src/utils/cartSync.js.
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
  endCartSession,
  flushCartPersist,
  mergeGuestCartOnLogin,
  scheduleCartPersist,
  startCartTabSync,
} = await import("./cartSync.js");
const { AUTH_TOKEN_STORAGE_KEY } = await import("./constants.js");

let activeCartChannel = null;

globalThis.BroadcastChannel = class RecordingBroadcastChannel {
  constructor(name) {
    this.name = name;
    this.onmessage = null;
    activeCartChannel = this;
  }

  postMessage() {}
};

/**
 * Builds a signed-in cart.
 *
 * @returns {object} Shell state.
 */
function createSignedInCart() {
  return {
    authToken: "token-01",
    currentUser: { id: "u-01", fullName: "Ada" },
    cartItems: [{ productId: "mug", quantity: 1 }],
    appliedCoupon: { code: "SAVE", discountPercentage: 10 },
  };
}

/**
 * Dispatches a storage event the cart tab listener can read.
 *
 * @param {string | null} key - Storage key that changed.
 * @param {string | null} newValue - Replacement value.
 * @returns {void}
 */
function dispatchStorage(key, newValue) {
  const storageEvent = new Event("storage");
  storageEvent.key = key;
  storageEvent.newValue = newValue;
  window.dispatchEvent(storageEvent);
}

/**
 * Delivers a cross-tab cart message when this branch opened a channel.
 *
 * @param {object | null} message - Broadcast payload.
 * @returns {void}
 */
function deliverCartMessage(message) {
  if (activeCartChannel && typeof activeCartChannel.onmessage === "function") {
    activeCartChannel.onmessage({ data: message });
  }
}

test("a remote cart notice and a removed auth token leave this tab signed out", async () => {
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  console.warn = () => {};
  const appState = createSignedInCart();

  try {
    startCartTabSync(appState);
    dispatchStorage("other-key", null);
    assert.equal(appState.authToken, "token-01");
    dispatchStorage(AUTH_TOKEN_STORAGE_KEY, "still-signed-in");
    assert.equal(appState.cartItems[0].productId, "mug");
    dispatchStorage(AUTH_TOKEN_STORAGE_KEY, null);
    assert.equal(appState.authToken, null);
    assert.deepEqual(appState.cartItems, []);
    dispatchStorage(AUTH_TOKEN_STORAGE_KEY, null);
    assert.equal(appState.currentUser, null);
    startCartTabSync(appState);
    assert.equal(appState.currentUser, null);

    globalThis.fetch = async (_url, options) => {
      if (options?.method === "PUT") {
        return { ok: true, json: async () => ({}) };
      }
      return {
        ok: true,
        json: async () => ({
          items: [{ productId: "saved", quantity: 1 }],
          appliedCoupon: null,
          updatedAt: "2026-10-01T00:00:00.000Z",
        }),
      };
    };
    const merging = createSignedInCart();
    merging.cartItems = [{ productId: "guest", quantity: 1 }];
    const mergeResult = await mergeGuestCartOnLogin(merging, "token-01", "u-01");
    assert.equal(typeof mergeResult.needsPersist, "boolean");
    assert.equal(merging.cartItems.some((cartItem) => cartItem.productId === "guest"), true);
    scheduleCartPersist(merging);
    await flushCartPersist();
    endCartSession(merging);
    assert.deepEqual(merging.cartItems, []);
  } finally {
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
  }
});
