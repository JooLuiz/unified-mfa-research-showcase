/**
 * Verifies live cart delivery stays quiet until a cart is pushed.
 * Role: Locks start, stop, and unsubscribe outcomes shared by both comparison branches.
 * Not in this file: A ticket fetch or a live connection.
 * Key dependencies: node:test; src/events/cartLiveEvents.js; test/support/createRecordingTransport.js.
 * See also: src/events/cartLiveEvents.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createRecordingTransport } from "../../../../test/support/createRecordingTransport.js";
import "../../../../test/support/installBrowserGlobals.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

const { startCartLiveEvents, stopCartLiveEvents, subscribeToCartLiveEvents } = await loadAppModule(
  new URL("./cartLiveEvents.js", import.meta.url).href,
);

test("a pushed live cart reaches the subscriber until stop", () => {
  const transport = createRecordingTransport();
  const deliveredCarts = [];
  const unsubscribe = subscribeToCartLiveEvents((cart) => {
    deliveredCarts.push(cart);
  });
  const liveCart = { items: [{ productId: "p-01", quantity: 2 }] };

  startCartLiveEvents(transport);
  transport.deliver("cart", "live-changed", liveCart);
  assert.deepEqual(deliveredCarts, [liveCart]);

  stopCartLiveEvents();
  transport.deliver("cart", "live-changed", { items: [{ productId: "p-02", quantity: 1 }] });
  unsubscribe();

  assert.deepEqual(deliveredCarts, [liveCart]);
});
