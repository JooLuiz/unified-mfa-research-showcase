/**
 * Verifies the catalog intent publishers and the shell's catalog intent listeners on an injected transport.
 * Role: Locks the payloads remotes publish and the payloads shell handlers receive on every comparison branch.
 * Not in this file: The add-to-cart and product-open basics (src/createCatalogEvents.test.js) or window names.
 * Key dependencies: node:test; src/createCatalogEvents.js; test/support/createRecordingTransport.js.
 * See also: src/createCatalogEvents.js; src/catalogEventsContracts.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createCatalogEvents } from "./createCatalogEvents.js";
import { createRecordingTransport } from "../../../test/support/createRecordingTransport.js";

const EMPTY_FILTERS = { searchQuery: "", minPrice: "", maxPrice: "", categoryIds: [] };

/**
 * Builds catalog events over a recording transport.
 *
 * @returns {{ transport: ReturnType<typeof createRecordingTransport>, catalogEvents: object }}
 */
function createRecordedCatalog() {
  const transport = createRecordingTransport();
  return { transport, catalogEvents: createCatalogEvents(transport) };
}

/**
 * Builds one recording handler per catalog intent.
 *
 * @returns {{ handlers: object, received: Record<string, unknown[]> }}
 */
function createRecordingHandlers() {
  const received = {};
  const handlers = {};
  for (const name of [
    "onProductOpenRequested",
    "onCartItemAddRequested",
    "onFiltersApplyRequested",
    "onPromotionApplied",
    "onCartItemUpdateRequested",
    "onCartItemRemoveRequested",
  ]) {
    received[name] = [];
    handlers[name] = (payload) => received[name].push(payload);
  }
  return { handlers, received };
}

test("filters and promotions are published as normalised filter snapshots", () => {
  const { transport, catalogEvents } = createRecordedCatalog();

  catalogEvents.publishFiltersApplyRequested({
    searchQuery: "mug",
    minPrice: 5,
    categoryIds: ["kitchen", 7],
  });
  catalogEvents.publishFiltersApplyRequested(null);
  catalogEvents.publishPromotionApplied({ filters: { maxPrice: "20" } });
  catalogEvents.publishPromotionApplied({});
  catalogEvents.publishPromotionApplied({ filters: "sale" });
  catalogEvents.publishPromotionApplied(null);

  assert.deepEqual(transport.published, [
    {
      topic: "catalog",
      event: "filters-apply-requested",
      payload: { searchQuery: "mug", minPrice: "5", maxPrice: "", categoryIds: ["kitchen"] },
      scope: "local",
    },
    {
      topic: "catalog",
      event: "promotion-applied",
      payload: { filters: { ...EMPTY_FILTERS, maxPrice: "20" } },
      scope: "local",
    },
    {
      topic: "catalog",
      event: "promotion-applied",
      payload: { filters: EMPTY_FILTERS },
      scope: "local",
    },
  ]);
});

test("cart line requests floor the quantity and drop invalid lines", () => {
  const { transport, catalogEvents } = createRecordedCatalog();

  catalogEvents.publishCartItemAddRequested({ productId: "mug", quantity: 2.7 });
  catalogEvents.publishCartItemAddRequested({ productId: "mug" });
  catalogEvents.publishCartItemUpdateRequested({ productId: "mug", quantity: 3.2 });
  catalogEvents.publishCartItemUpdateRequested({ productId: "mug", quantity: 0 });
  catalogEvents.publishCartItemUpdateRequested({ productId: "mug", quantity: Infinity });
  catalogEvents.publishCartItemUpdateRequested({ productId: " ", quantity: 1 });
  catalogEvents.publishCartItemRemoveRequested("mug");
  catalogEvents.publishCartItemRemoveRequested(" ");
  catalogEvents.publishCartItemRemoveRequested(undefined);

  assert.deepEqual(transport.published, [
    { topic: "cart", event: "item-add-requested", payload: { productId: "mug", quantity: 2 }, scope: "local" },
    { topic: "cart", event: "item-update-requested", payload: { productId: "mug", quantity: 3 }, scope: "local" },
    { topic: "cart", event: "item-remove-requested", payload: { productId: "mug" }, scope: "local" },
  ]);
});

test("a cart change carries the lines when given and an empty payload otherwise", () => {
  const { transport, catalogEvents } = createRecordedCatalog();

  catalogEvents.publishCartChanged([{ productId: "mug", quantity: 1 }]);
  catalogEvents.publishCartChanged();

  assert.deepEqual(
    transport.published.map((message) => message.payload),
    [{ items: [{ productId: "mug", quantity: 1 }] }, {}],
  );
});

test("each catalog intent handler receives only valid payloads", () => {
  const { transport, catalogEvents } = createRecordedCatalog();
  const { handlers, received } = createRecordingHandlers();
  catalogEvents.ensureCatalogIntentListeners(handlers);

  transport.deliver("catalog", "product-open-requested", { productId: "mug" });
  transport.deliver("catalog", "product-open-requested", { productId: "" });
  transport.deliver("catalog", "product-open-requested", null);
  transport.deliver("cart", "item-add-requested", { productId: "mug", quantity: 1 });
  transport.deliver("cart", "item-add-requested", { productId: "mug", quantity: -1 });
  transport.deliver("catalog", "filters-apply-requested", { searchQuery: "hat" });
  transport.deliver("catalog", "filters-apply-requested", "hat");
  transport.deliver("catalog", "promotion-applied", { filters: { minPrice: "1" } });
  transport.deliver("catalog", "promotion-applied", {});
  transport.deliver("catalog", "promotion-applied", { filters: 3 });
  transport.deliver("cart", "item-update-requested", { productId: "mug", quantity: 4 });
  transport.deliver("cart", "item-update-requested", { productId: "mug", quantity: "4" });
  transport.deliver("cart", "item-remove-requested", { productId: "mug" });
  transport.deliver("cart", "item-remove-requested", { productId: 7 });

  assert.deepEqual(received, {
    onProductOpenRequested: [{ productId: "mug" }],
    onCartItemAddRequested: [{ productId: "mug", quantity: 1 }],
    onFiltersApplyRequested: [{ ...EMPTY_FILTERS, searchQuery: "hat" }],
    onPromotionApplied: [
      { filters: { ...EMPTY_FILTERS, minPrice: "1" } },
      { filters: EMPTY_FILTERS },
    ],
    onCartItemUpdateRequested: [{ productId: "mug", quantity: 4 }],
    onCartItemRemoveRequested: [{ productId: "mug" }],
  });
});

test("catalog intent listeners register once and again after a reset", () => {
  const { transport, catalogEvents } = createRecordedCatalog();
  const { handlers, received } = createRecordingHandlers();

  catalogEvents.ensureCatalogIntentListeners(handlers);
  catalogEvents.ensureCatalogIntentListeners(handlers);
  transport.deliver("catalog", "product-open-requested", { productId: "mug" });
  assert.equal(received.onProductOpenRequested.length, 1);

  catalogEvents.resetCatalogIntentListeners();
  catalogEvents.ensureCatalogIntentListeners(handlers);
  transport.deliver("catalog", "product-open-requested", { productId: "cup" });
  // The recording transport keeps the first subscription, so the re-registered one adds a second call.
  assert.deepEqual(received.onProductOpenRequested, [
    { productId: "mug" },
    { productId: "cup" },
    { productId: "cup" },
  ]);
});

test("intents without a handler are not subscribed", () => {
  const { transport, catalogEvents } = createRecordedCatalog();
  const opened = [];
  catalogEvents.ensureCatalogIntentListeners({
    onProductOpenRequested: (payload) => opened.push(payload),
  });

  transport.deliver("cart", "item-add-requested", { productId: "mug", quantity: 1 });
  transport.deliver("catalog", "filters-apply-requested", { searchQuery: "hat" });
  transport.deliver("catalog", "promotion-applied", {});
  transport.deliver("cart", "item-update-requested", { productId: "mug", quantity: 1 });
  transport.deliver("cart", "item-remove-requested", { productId: "mug" });
  transport.deliver("catalog", "product-open-requested", { productId: "mug" });

  assert.deepEqual(opened, [{ productId: "mug" }]);
});
