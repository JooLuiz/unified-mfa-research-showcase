/**
 * Verifies catalog and cart messages on an injected transport.
 * Role: Locks topic, event, payload, scope, and the invalid add-to-cart guard.
 * Not in this file: Cart mutation or window event names.
 * Key dependencies: node:test; src/createCatalogEvents.js; test/support/createRecordingTransport.js.
 * See also: src/createCatalogEvents.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createCatalogEvents } from "./createCatalogEvents.js";
import { createRecordingTransport } from "../../../test/support/createRecordingTransport.js";

test("publishCartItemAddRequested emits a local cart message and drops an invalid payload", () => {
  const transport = createRecordingTransport();
  const catalogEvents = createCatalogEvents(transport);

  catalogEvents.publishCartItemAddRequested({ productId: "p-01", quantity: 1 });
  catalogEvents.publishCartItemAddRequested({ productId: "" });
  catalogEvents.publishCartItemAddRequested({ productId: "p-01", quantity: Number.NaN });

  assert.deepEqual(transport.published, [
    {
      topic: "cart",
      event: "item-add-requested",
      payload: { productId: "p-01", quantity: 1 },
      scope: "local",
    },
  ]);
});

test("subscribeToCartItemAddRequests ignores an invalid payload and stops after unsubscribe", () => {
  const transport = createRecordingTransport();
  const catalogEvents = createCatalogEvents(transport);
  const received = [];
  const unsubscribe = catalogEvents.subscribeToCartItemAddRequests((payload) => {
    received.push(payload);
  });

  transport.publish({
    topic: "cart",
    event: "item-add-requested",
    payload: { productId: "" },
    scope: "local",
  });
  catalogEvents.publishCartItemAddRequested({ productId: "p-02", quantity: 2 });
  unsubscribe();
  catalogEvents.publishCartItemAddRequested({ productId: "p-03", quantity: 1 });

  assert.deepEqual(received, [{ productId: "p-02", quantity: 2 }]);
});

test("publishCartChanged and publishProductOpenRequested use their contract names", () => {
  const transport = createRecordingTransport();
  const catalogEvents = createCatalogEvents(transport);
  const cartChanges = [];
  catalogEvents.subscribeToCartChanges(() => {
    cartChanges.push("changed");
  });

  catalogEvents.publishCartChanged();
  catalogEvents.publishProductOpenRequested({ productId: "p-01" });

  assert.deepEqual(transport.published, [
    { topic: "cart", event: "changed", scope: "local" },
    {
      topic: "catalog",
      event: "product-open-requested",
      payload: { productId: "p-01" },
      scope: "local",
    },
  ]);
  assert.deepEqual(cartChanges, ["changed"]);
});
