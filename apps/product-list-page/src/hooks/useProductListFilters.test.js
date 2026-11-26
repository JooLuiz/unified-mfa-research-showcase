/**
 * Verifies the product-list filter state a shopper edits and applies.
 * Role: Locks draft edits, category toggles, apply, clear, tag removal, sort, and the mobile panel.
 * Not in this file: How applied filters reach the host shell, or the product request.
 * Key dependencies: node:test; react; src/hooks/useProductListFilters.js; test/support/installDomDocument.js.
 * See also: src/hooks/useProductListFilters.js; src/productListFilters.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement, useCallback } from "react";
import { createRoot } from "react-dom/client";
import "../../../../test/support/installBrowserGlobals.js";
import { installDomDocument } from "../../../../test/support/installDomDocument.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

const { useProductListFilters } = await loadAppModule(
  new URL("./useProductListFilters.js", import.meta.url).href,
);

/**
 * Mounts a probe that runs the hook and exposes its latest result.
 *
 * @param {{ initialFilters?: object, initialSort?: string }} input - Hook inputs from the host.
 * @returns {Promise<{ read: () => object, run: (action: (hook: object) => void) => Promise<void>, applied: object[], resets: () => number, unmount: () => Promise<void> }>} Probe controls.
 */
async function mountFilters(input) {
  const { root } = installDomDocument();
  const reactRoot = createRoot(root);
  const applied = [];
  let resetCount = 0;
  let latest = null;

  function FiltersProbe() {
    const onFiltersApplied = useCallback(() => {
      resetCount += 1;
    }, []);
    const recordApplied = useCallback((nextFilters) => {
      applied.push(nextFilters);
    }, []);
    // Each comparison branch reads its own option name for the applied-filters callback.
    latest = useProductListFilters({
      ...input,
      onFiltersChange: recordApplied,
      publishFiltersApply: recordApplied,
      onFiltersApplied,
    });
    return null;
  }

  await act(async () => {
    reactRoot.render(createElement(FiltersProbe));
  });
  return {
    read: () => latest,
    async run(action) {
      await act(async () => {
        action(latest);
      });
    },
    applied,
    resets: () => resetCount,
    async unmount() {
      await act(async () => {
        reactRoot.unmount();
      });
    },
  };
}

const initialFilters = { searchQuery: "lamp", minPrice: "", maxPrice: "", categoryIds: ["lighting"] };

test("draft edits keep numeric prices only, and a selected category toggles off", async () => {
  const filters = await mountFilters({ initialFilters });
  try {
    assert.equal(filters.read().activeSort, "");
    await filters.run((hook) => hook.updateSearchQuery("desk"));
    await filters.run((hook) => hook.handleFilterInputChange("minPrice", "12"));
    await filters.run((hook) => hook.handleFilterInputChange("minPrice", "1a"));
    await filters.run((hook) => hook.adjustFilterValue("maxPrice", -5));
    await filters.run((hook) => hook.toggleCategorySelection("lighting"));
    await filters.run((hook) => hook.toggleCategorySelection("desks"));

    assert.deepEqual(filters.read().draftFilters, {
      searchQuery: "desk",
      minPrice: "12",
      maxPrice: "0",
      categoryIds: ["desks"],
    });
    assert.deepEqual(filters.read().activeFilters, initialFilters);
    assert.deepEqual(filters.applied, []);
  } finally {
    await filters.unmount();
  }
});

test("applying trims the search and closes the mobile panel on a small screen", async () => {
  const filters = await mountFilters({ initialFilters, initialSort: "price-asc" });
  const originalWidth = window.innerWidth;
  window.innerWidth = 500;
  try {
    assert.equal(filters.read().activeSort, "price-asc");
    await filters.run((hook) => hook.toggleMobileFilters());
    assert.equal(filters.read().isMobileFiltersOpen, true);
    await filters.run((hook) => hook.updateSearchQuery("  desk  "));
    await filters.run((hook) => hook.handleFilterInputChange("maxPrice", "40"));
    const resetsBefore = filters.resets();
    await filters.run((hook) => hook.applyFilters());

    const expected = { searchQuery: "desk", minPrice: "", maxPrice: "40", categoryIds: ["lighting"] };
    assert.deepEqual(filters.read().activeFilters, expected);
    assert.deepEqual(filters.applied, [expected]);
    assert.equal(filters.read().isMobileFiltersOpen, false);
    assert.equal(filters.resets() > resetsBefore, true);
  } finally {
    window.innerWidth = originalWidth;
    await filters.unmount();
  }
});

test("applying on a wide screen keeps the mobile panel open", async () => {
  const filters = await mountFilters({ initialFilters });
  const originalWidth = window.innerWidth;
  window.innerWidth = 1280;
  try {
    await filters.run((hook) => hook.toggleMobileFilters());
    await filters.run((hook) => hook.applyFilters());
    assert.equal(filters.read().isMobileFiltersOpen, true);
  } finally {
    window.innerWidth = originalWidth;
    await filters.unmount();
  }
});

test("removing tags and clearing reset the matching filters", async () => {
  const filters = await mountFilters({
    initialFilters: { searchQuery: "lamp", minPrice: "5", maxPrice: "50", categoryIds: ["lighting", "desks"] },
  });
  try {
    await filters.run((hook) => hook.removeActiveFilter("category:lighting"));
    assert.deepEqual(filters.read().activeFilters.categoryIds, ["desks"]);
    await filters.run((hook) => hook.removeActiveFilter("searchQuery"));
    await filters.run((hook) => hook.removeActiveFilter("minPrice"));
    await filters.run((hook) => hook.removeActiveFilter("maxPrice"));
    assert.deepEqual(filters.read().activeFilters, {
      searchQuery: "",
      minPrice: "",
      maxPrice: "",
      categoryIds: ["desks"],
    });

    await filters.run((hook) => hook.handleSortChange("price-desc"));
    assert.equal(filters.read().activeSort, "price-desc");

    await filters.run((hook) => hook.clearFilters());
    const cleared = { searchQuery: "", minPrice: "", maxPrice: "", categoryIds: [] };
    assert.deepEqual(filters.read().activeFilters, cleared);
    assert.deepEqual(filters.read().draftFilters, cleared);
    assert.deepEqual(filters.applied.at(-1), cleared);
    assert.equal(filters.applied.length, 5);
  } finally {
    await filters.unmount();
  }
});
