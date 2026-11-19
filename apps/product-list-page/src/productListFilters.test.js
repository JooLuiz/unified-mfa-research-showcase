/**
 * Verifies product-list filter normalization and query building.
 * Role: Locks the filter shape, price coercion, query string, and active-tag labels.
 * Not in this file: Filter state, fetching, or rendering.
 * Key dependencies: node:test; src/productListFilters.js.
 * See also: src/productListFilters.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  buildActiveFilterTags,
  buildProductsQueryString,
  getNumericValue,
  normalizeFilterValue,
  normalizeFilters,
} from "./productListFilters.js";

test("normalizeFilters returns empty strings and drops non-string category ids", () => {
  assert.deepEqual(normalizeFilters(null), {
    searchQuery: "",
    minPrice: "",
    maxPrice: "",
    categoryIds: [],
  });
  assert.deepEqual(normalizeFilters({ categoryIds: "cat-lighting" }).categoryIds, []);
  assert.deepEqual(
    normalizeFilters({ categoryIds: ["cat-lighting", 2, null] }).categoryIds,
    ["cat-lighting"],
  );
});

test("normalizeFilterValue floors a non-negative price and rejects a negative", () => {
  assert.equal(normalizeFilterValue(""), "");
  assert.equal(normalizeFilterValue("-3"), "0");
  assert.equal(normalizeFilterValue("1.5"), "1");
  assert.equal(normalizeFilterValue("40"), "40");
});

test("getNumericValue floors a non-negative price and treats a blank as zero", () => {
  assert.equal(getNumericValue(""), 0);
  assert.equal(getNumericValue("-3"), 0);
  assert.equal(getNumericValue("1.5"), 1);
  assert.equal(getNumericValue("40"), 40);
});

test("buildProductsQueryString omits blank filters and encodes the rest", () => {
  const emptyFilters = normalizeFilters(null);

  assert.equal(buildProductsQueryString(emptyFilters), "");
  assert.equal(
    buildProductsQueryString({ ...emptyFilters, searchQuery: "lamp" }),
    "search=lamp",
  );
  assert.equal(
    buildProductsQueryString({ ...emptyFilters, minPrice: "10" }),
    "minPrice=10",
  );
  assert.equal(
    buildProductsQueryString({ ...emptyFilters, maxPrice: "150" }),
    "maxPrice=150",
  );
  assert.equal(
    buildProductsQueryString({ ...emptyFilters, minPrice: "", maxPrice: "" }),
    "",
  );
  assert.equal(
    buildProductsQueryString({ ...emptyFilters, categoryIds: ["cat-lighting"] }),
    "categoryIds=cat-lighting",
  );
  assert.equal(buildProductsQueryString(emptyFilters, "price"), "sortBy=price");
});

test("buildActiveFilterTags labels search, min price, and an unknown category id", () => {
  const tags = buildActiveFilterTags(
    {
      searchQuery: "lamp",
      minPrice: "10",
      maxPrice: "150",
      categoryIds: ["cat-lighting", "cat-unknown"],
    },
    [{ id: "cat-lighting", name: "Lighting" }],
  );

  assert.deepEqual(
    tags.map((tag) => tag.label),
    ["Search: lamp", "Min Price: $10", "Max Price: $150", "Category: Lighting", "Category: cat-unknown"],
  );
});
