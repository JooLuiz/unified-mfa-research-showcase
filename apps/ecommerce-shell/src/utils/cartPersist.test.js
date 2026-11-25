/**
 * Verifies the cart save queue: suspended, cleared, failed, and queued saves.
 * Role: Locks that the persist queue stays idle when a save is suspended or cleared, keeps
 *   saving after a failure, and that waiting for idle covers a save queued mid-send.
 * Not in this file: Cross-tab delivery of a saved cart (src/utils/cartSync.js).
 * Key dependencies: node:test; src/utils/cartPersist.js; test/support/createRecordingTransport.js; test/support/loadAppModule.js.
 * See also: src/utils/cartPersist.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createRecordingTransport } from "../../../../test/support/createRecordingTransport.js";
import "../../../../test/support/installBrowserGlobals.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

const {
  flushCartPersist,
  isCartPersistBusy,
  resumeCartPersist,
  runWithoutCartPersist,
  scheduleCartPersist,
  setCartSavedNotifier,
  suspendCartPersist,
} = await loadAppModule(new URL("./cartPersist.js", import.meta.url).href);

const savedSnapshots = [];
setCartSavedNotifier((snapshot) => {
  savedSnapshots.push(snapshot);
});

/**
 * Builds a signed-in cart the persist queue is allowed to save.
 *
 * @returns {object} Shell state.
 */
function createSignedInCart() {
  return {
    authToken: "token-01",
    currentUser: { id: "u-01" },
    cartItems: [{ productId: "mug", quantity: 1 }],
    appliedCoupon: { code: "SAVE", discountPercentage: 10 },
  };
}

test("a suspended save and a save cleared before it is sent finish idle", async (parentTest) => {
  try {
    await parentTest.test("a suspended save and a remote replacement do not write", async () => {
      const appState = createSignedInCart();
      const transport = createRecordingTransport();

      suspendCartPersist();
      scheduleCartPersist(appState, transport);
      assert.equal(isCartPersistBusy(), false);

      resumeCartPersist();
      runWithoutCartPersist(() => {
        scheduleCartPersist(appState, transport);
      });
      await flushCartPersist();
      assert.equal(transport.published.length, 0);
      assert.equal(isCartPersistBusy(), false);
    });

    await parentTest.test("a save cleared before it is sent finishes idle", async () => {
      const appState = createSignedInCart();
      const transport = createRecordingTransport();
      scheduleCartPersist(appState, transport);
      suspendCartPersist();
      await flushCartPersist();
      assert.equal(transport.published.length, 0);
      assert.equal(isCartPersistBusy(), false);
      resumeCartPersist();
    });
  } finally {
    resumeCartPersist();
  }
});

/**
 * Returns the cart sent in each recorded save.
 *
 * @param {{ published: object[] }} transport - Recording transport.
 * @returns {object[]} Saved carts in send order.
 */
function sentCarts(transport) {
  return transport.published.map((message) => message.payload.cart);
}

test("failed saves and a save queued mid-send", async (parentTest) => {
  try {
    await parentTest.test("a failed or rejected save does not stop a later save", async () => {
      const rejectedTransport = createRecordingTransport({ requestReply: { ok: false } });
      scheduleCartPersist(createSignedInCart(), rejectedTransport);
      await flushCartPersist();
      assert.equal(rejectedTransport.published.length, 1);
      assert.equal(savedSnapshots.length, 0);
      assert.equal(isCartPersistBusy(), false);

      const offlineTransport = createRecordingTransport();
      offlineTransport.request = async (message) => {
        offlineTransport.published.push(message);
        throw new Error("offline");
      };
      const originalWarn = console.warn;
      console.warn = () => {};
      try {
        scheduleCartPersist(createSignedInCart(), offlineTransport);
        await flushCartPersist();
      } finally {
        console.warn = originalWarn;
      }
      assert.equal(offlineTransport.published.length, 1);
      assert.equal(savedSnapshots.length, 0);

      const appState = createSignedInCart();
      appState.cartItems = [{ productId: "cup", quantity: 2 }];
      const healthyTransport = createRecordingTransport();
      scheduleCartPersist(appState, healthyTransport);
      await flushCartPersist();
      assert.deepEqual(sentCarts(healthyTransport).map((cart) => cart.items), [appState.cartItems]);
      assert.deepEqual(savedSnapshots, [
        { userId: "u-01", items: appState.cartItems, appliedCoupon: appState.appliedCoupon },
      ]);
      assert.equal(isCartPersistBusy(), false);
    });

    await parentTest.test("waiting for idle also waits for a save queued while the first is sending", async () => {
      let markStarted;
      const started = new Promise((resolve) => {
        markStarted = resolve;
      });
      let releaseFirst;
      const firstTransport = createRecordingTransport();
      firstTransport.request = (message) => {
        firstTransport.published.push(message);
        markStarted();
        return new Promise((resolve) => {
          releaseFirst = () => resolve({ ok: true });
        });
      };
      scheduleCartPersist(createSignedInCart(), firstTransport);
      await started;

      let idleSettled = false;
      const idle = flushCartPersist().then(() => {
        idleSettled = true;
      });
      const nextCart = createSignedInCart();
      nextCart.cartItems = [{ productId: "cup", quantity: 3 }];
      const secondTransport = createRecordingTransport();
      scheduleCartPersist(nextCart, secondTransport);
      assert.equal(isCartPersistBusy(), true);

      await new Promise((resolve) => setTimeout(resolve, 0));
      assert.equal(idleSettled, false);
      releaseFirst();
      await idle;

      assert.deepEqual(sentCarts(secondTransport).map((cart) => cart.items), [nextCart.cartItems]);
      assert.deepEqual(savedSnapshots.at(-1).items, nextCart.cartItems);
      assert.equal(isCartPersistBusy(), false);
    });
  } finally {
    resumeCartPersist();
  }
});

test("a save for a session with no user record notifies a null user", async () => {
  const appState = { ...createSignedInCart(), currentUser: null };
  const transport = createRecordingTransport({ requestReply: { ok: true } });
  const savedBefore = savedSnapshots.length;

  scheduleCartPersist(appState, transport);
  await flushCartPersist();

  assert.equal(isCartPersistBusy(), false);
  assert.equal(savedSnapshots.length, savedBefore + 1);
  assert.equal(savedSnapshots.at(-1).userId, null);
  assert.deepEqual(savedSnapshots.at(-1).items, [{ productId: "mug", quantity: 1 }]);
});
