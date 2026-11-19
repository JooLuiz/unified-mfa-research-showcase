/**
 * Verifies a suspended or cleared cart save never starts a write.
 * Role: Locks that the persist queue stays idle when a save is suspended or cleared before send.
 * Not in this file: A save the server rejects or accepts. That write uses the branch transport.
 * Key dependencies: node:test; src/utils/cartPersist.js; test/support/loadAppModule.js.
 * See also: src/utils/cartPersist.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import "../../../../test/support/installBrowserGlobals.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

const {
  flushCartPersist,
  isCartPersistBusy,
  resumeCartPersist,
  runWithoutCartPersist,
  scheduleCartPersist,
  suspendCartPersist,
} = await loadAppModule(new URL("./cartPersist.js", import.meta.url).href);

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
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  console.warn = () => {};

  try {
    await parentTest.test("a suspended save and a remote replacement do not write", async () => {
      const appState = createSignedInCart();
      let saveAttempts = 0;
      globalThis.fetch = async () => {
        saveAttempts += 1;
        throw new Error("offline");
      };

      suspendCartPersist();
      scheduleCartPersist(appState);
      assert.equal(isCartPersistBusy(), false);

      resumeCartPersist();
      runWithoutCartPersist(() => {
        scheduleCartPersist(appState);
      });
      await flushCartPersist();
      assert.equal(saveAttempts, 0);
      assert.equal(isCartPersistBusy(), false);
    });

    await parentTest.test("a save cleared before it is sent finishes idle", async () => {
      const appState = createSignedInCart();
      scheduleCartPersist(appState);
      suspendCartPersist();
      await flushCartPersist();
      assert.equal(isCartPersistBusy(), false);
      resumeCartPersist();
    });
  } finally {
    console.warn = originalWarn;
    globalThis.fetch = originalFetch;
    resumeCartPersist();
  }
});
