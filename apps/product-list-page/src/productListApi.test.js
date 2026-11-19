/**
 * Verifies product list requests return their payload and surface a failed response.
 * Role: Locks fetchCategories and fetchFilteredProducts outcomes.
 * Not in this file: The product grid.
 * Key dependencies: node:test; src/productListApi.js.
 * See also: src/productListApi.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { loadAppModule } from "../../../test/support/loadAppModule.js";

const { fetchCategories, fetchFilteredProducts } = await loadAppModule(
  new URL("./productListApi.js", import.meta.url).href,
);

test("product list requests return their payload, and a failed response rejects", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes("/categories")) {
      return { ok: true, status: 200, statusText: "OK", json: async () => [{ id: "cat-lighting" }] };
    }
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ total: 1, items: [{ id: "p-01" }] }),
    };
  };

  try {
    const categories = await fetchCategories("http://localhost:4000/api", undefined);
    assert.equal(categories[0].id, "cat-lighting");
    const filters = { searchQuery: "lamp", minPrice: "", maxPrice: "", categoryIds: [] };
    const products = await fetchFilteredProducts(
      "http://localhost:4000/api",
      filters,
      "price",
      undefined,
    );
    assert.equal(products.items[0].id, "p-01");

    const unfiltered = await fetchFilteredProducts(
      "http://localhost:4000/api",
      { searchQuery: "", minPrice: "", maxPrice: "", categoryIds: [] },
      "",
      undefined,
    );
    assert.equal(unfiltered.total, 1);

    globalThis.fetch = async () => ({ ok: false, status: 500, statusText: "Error", json: async () => ({}) });
    await assert.rejects(
      () => fetchCategories("http://localhost:4000/api", undefined),
      /fetchCategories - request failed: 500/,
    );
    await assert.rejects(
      () =>
        fetchFilteredProducts(
          "http://localhost:4000/api",
          { searchQuery: "", minPrice: "", maxPrice: "", categoryIds: [] },
          "",
          undefined,
        ),
      /fetchFilteredProducts - request failed: 500/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
