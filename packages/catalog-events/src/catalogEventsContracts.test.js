/**
 * Verifies the catalog and cart payload validators and normalisers.
 * Role: Locks which payloads count as valid and how they are normalised on every comparison branch.
 * Not in this file: Publishing or subscribing (src/createCatalogEvents.test.js, src/createCatalogIntentApi.test.js).
 * Key dependencies: node:test; src/catalogEventsContracts.js.
 * See also: src/catalogEventsContracts.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  createCartAddRequest,
  createCartUpdateRequest,
  createPlpFiltersSnapshot,
  isValidCartRemoveRequest,
  isValidCartUpdateRequest,
  isValidPlpFiltersPayload,
  isValidProductOpenRequest,
  isValidPromotionAppliedRequest,
} from "./catalogEventsContracts.js";

test("a product request needs a non-blank string id", () => {
  assert.equal(isValidProductOpenRequest({ productId: "mug" }), true);
  assert.equal(isValidProductOpenRequest({ productId: "  " }), false);
  assert.equal(isValidProductOpenRequest({ productId: 3 }), false);
  assert.equal(isValidProductOpenRequest(null), false);
  assert.equal(isValidCartRemoveRequest({ productId: "mug" }), true);
  assert.equal(isValidCartRemoveRequest("mug"), false);
});

test("a cart line needs an id and a positive finite quantity, and is floored", () => {
  assert.equal(isValidCartUpdateRequest({ productId: "mug", quantity: 1 }), true);
  assert.equal(isValidCartUpdateRequest({ productId: "mug", quantity: 0 }), false);
  assert.equal(isValidCartUpdateRequest({ productId: "", quantity: 1 }), false);
  assert.equal(isValidCartUpdateRequest(undefined), false);
  assert.deepEqual(createCartAddRequest({ productId: "mug", quantity: 2.9 }), {
    productId: "mug",
    quantity: 2,
  });
  assert.equal(createCartAddRequest({ productId: "mug", quantity: NaN }), null);
  assert.deepEqual(createCartUpdateRequest({ productId: "cup", quantity: 1.5 }), {
    productId: "cup",
    quantity: 1,
  });
  assert.equal(createCartUpdateRequest(null), null);
});

test("filter snapshots are strings with string-only categories, and empty for a non-object", () => {
  assert.deepEqual(createPlpFiltersSnapshot("mug"), {
    searchQuery: "",
    minPrice: "",
    maxPrice: "",
    categoryIds: [],
  });
  assert.deepEqual(createPlpFiltersSnapshot({ maxPrice: 9, categoryIds: "kitchen" }), {
    searchQuery: "",
    minPrice: "",
    maxPrice: "9",
    categoryIds: [],
  });
});

test("a filters payload is any object, and a promotion carries object or missing filters", () => {
  assert.equal(isValidPlpFiltersPayload({}), true);
  assert.equal(isValidPlpFiltersPayload(null), false);
  assert.equal(isValidPromotionAppliedRequest({ filters: {} }), true);
  assert.equal(isValidPromotionAppliedRequest({}), true);
  assert.equal(isValidPromotionAppliedRequest({ filters: "sale" }), false);
  assert.equal(isValidPromotionAppliedRequest(undefined), false);
});
