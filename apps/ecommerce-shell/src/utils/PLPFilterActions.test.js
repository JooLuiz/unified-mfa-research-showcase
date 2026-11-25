/**
 * Verifies how stored and promotional product-list filters are normalized.
 * Role: Locks the filter values the product list reads back from storage and from a promotion URL.
 * Not in this file: Product list rendering or filter change delivery.
 * Key dependencies: node:test; src/utils/PLPFilterActions.js; test/support/installBrowserGlobals.js.
 * See also: src/utils/PLPFilterActions.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import "../../../../test/support/installBrowserGlobals.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

const { FILTER_STORAGE_KEY } = await loadAppModule(new URL("./constants.js", import.meta.url).href);
const { applyPlpFiltersFromLocation, normalizePlpFilters, readStoredPLPFilters } = await loadAppModule(
  new URL("./PLPFilterActions.js", import.meta.url).href,
);

const defaultFilters = { searchQuery: "", minPrice: "", maxPrice: "", categoryIds: [] };

test("stored filters without a search or categories read back as empty values", () => {
  localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify({ minPrice: "5" }));
  const appState = { plpFilters: { ...defaultFilters, searchQuery: "old" } };

  readStoredPLPFilters(appState);

  assert.deepEqual(appState.plpFilters, { ...defaultFilters, minPrice: "5" });
});

test("stored categories keep only string ids", () => {
  localStorage.setItem(
    FILTER_STORAGE_KEY,
    JSON.stringify({ searchQuery: "mug", maxPrice: "20", categoryIds: ["c-01", 7, null] }),
  );
  const appState = { plpFilters: defaultFilters };

  readStoredPLPFilters(appState);

  assert.deepEqual(appState.plpFilters, { ...defaultFilters, searchQuery: "mug", maxPrice: "20", categoryIds: ["c-01"] });
});

test("no stored value or an unreadable one leaves the filters unchanged", (testContext) => {
  testContext.mock.method(console, "warn", () => {});
  const appState = { plpFilters: { ...defaultFilters, searchQuery: "keep" } };

  localStorage.removeItem(FILTER_STORAGE_KEY);
  readStoredPLPFilters(appState);
  assert.equal(appState.plpFilters.searchQuery, "keep");

  localStorage.setItem(FILTER_STORAGE_KEY, "{broken");
  readStoredPLPFilters(appState);
  assert.equal(appState.plpFilters.searchQuery, "keep");
});

test("normalizing filters with no categories or search gives empty values", () => {
  assert.deepEqual(normalizePlpFilters({}), defaultFilters);
  assert.deepEqual(normalizePlpFilters({ searchQuery: 3, categoryIds: "c-01" }), { ...defaultFilters, searchQuery: "3" });
});

test("a URL without promotional filters keeps the current filters", () => {
  const appState = { plpFilters: { ...defaultFilters, searchQuery: "keep" } };

  assert.equal(applyPlpFiltersFromLocation(appState, "?searchQuery=%20&page=2"), false);
  assert.equal(applyPlpFiltersFromLocation(appState, ""), false);
  assert.equal(appState.plpFilters.searchQuery, "keep");
});
