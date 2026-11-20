/**
 * Verifies a suspended or cleared cart save never starts a write.
 * Role: Locks that the persist queue stays idle when a save is suspended or cleared before send.
 * Not in this file: A save the server rejects or accepts.
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
