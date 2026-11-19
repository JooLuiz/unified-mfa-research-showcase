/**
 * Verifies live cart delivery stays quiet when the shopper has no session.
 * Role: Locks start, stop, and unsubscribe outcomes shared by both comparison branches.
 * Not in this file: A ticket fetch or a live connection. Those paths differ by branch and belong in e2e.
 * Key dependencies: node:test; src/events/cartLiveEvents.js.
 * See also: src/events/cartLiveEvents.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import "../../../../test/support/installBrowserGlobals.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

const { startCartLiveEvents, stopCartLiveEvents, subscribeToCartLiveEvents } = await loadAppModule(
  new URL("./cartLiveEvents.js", import.meta.url).href,
);

test("a shopper without a token receives no live cart, and unsubscribe is safe", async () => {
  const deliveredCarts = [];
  const unsubscribe = subscribeToCartLiveEvents((cart) => {
    deliveredCarts.push(cart);
  });

  await startCartLiveEvents({ authToken: "" });
  unsubscribe();
  stopCartLiveEvents();

  assert.deepEqual(deliveredCarts, []);
});
