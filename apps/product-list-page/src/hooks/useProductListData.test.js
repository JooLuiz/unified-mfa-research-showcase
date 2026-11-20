/**
 * Verifies product-list loading states a shopper can see in the hook result.
 * Role: Locks provided data, an empty base URL, filtered requests, failed loads, and aborted loads.
 * Not in this file: Filter controls or the product grid.
 * Key dependencies: node:test; src/hooks/useProductListData.js; test/support/installDomDocument.js; test/support/loadAppModule.js.
 * See also: src/hooks/useProductListData.js; src/productListApi.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import "../../../../test/support/installBrowserGlobals.js";
import { installDomDocument } from "../../../../test/support/installDomDocument.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

const { useProductListData } = await loadAppModule(
  new URL("./useProductListData.js", import.meta.url).href,
);

const API_BASE_URL = "http://localhost:4000/api";
const LIGHTING_CATEGORY_IDS = ["lighting"];
let previousListTest = Promise.resolve();

/** Runs one hook test after the previous one so fetch stand-ins do not overlap. */
function testList(name, run) {
  test(name, async () => {
    const earlierTest = previousListTest;
    let releaseEarlierTest = () => {};
    previousListTest = new Promise((resolve) => {
      releaseEarlierTest = resolve;
    });
    await earlierTest;
    try {
      await run();
    } finally {
      releaseEarlierTest();
    }
  });
}

/** Builds filters whose category list stays the same array across renders. */
function createFilters(searchQuery) {
  return {
    searchQuery,
    minPrice: "10",
    maxPrice: "40",
    categoryIds: LIGHTING_CATEGORY_IDS,
  };
}

/** Builds a fetch response with a JSON body. */
function jsonResponse(body, ok = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? "OK" : "Error",
    json: async () => body,
  };
}

/** Mounts the hook and keeps its latest return value. */
async function mountProductList(input) {
  const { root } = installDomDocument();
  const reactRoot = createRoot(root);
  let latest = null;

  function ProductListProbe() {
    latest = useProductListData(input);
    return null;
  }

  await act(async () => {
    reactRoot.render(createElement(ProductListProbe));
  });

  return {
    read() {
      return latest;
    },
    async unmount() {
      await act(async () => {
        reactRoot.unmount();
      });
    },
  };
}

testList("provided products and categories are returned without a request", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error("fetch should not run");
  };

  const mounted = await mountProductList({
    apiBaseUrl: API_BASE_URL,
    providedProducts: [{ id: "given-product" }],
    providedCategories: [{ id: "given-category" }],
    activeFilters: createFilters(""),
    activeSort: "",
  });

  try {
    assert.equal(fetchCalls, 0);
    assert.equal(mounted.read().hasProvidedProducts, true);
    assert.equal(mounted.read().availableCategories[0].id, "given-category");
    assert.equal(mounted.read().fetchedProducts[0].id, "given-product");
    assert.equal(mounted.read().productsLoadError, null);
  } finally {
    await mounted.unmount();
    globalThis.fetch = originalFetch;
  }
});

testList("a missing base URL leaves both lists empty", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error("fetch should not run");
  };

  const mounted = await mountProductList({
    apiBaseUrl: "",
    activeFilters: createFilters(""),
    activeSort: "",
  });

  try {
    assert.equal(fetchCalls, 0);
    assert.deepEqual(mounted.read().availableCategories, []);
    assert.deepEqual(mounted.read().fetchedProducts, []);
    assert.equal(mounted.read().isFetchingProducts, false);
  } finally {
    await mounted.unmount();
    globalThis.fetch = originalFetch;
  }
});

testList("filtered product requests follow the search, price, category, and sort", async () => {
  const originalFetch = globalThis.fetch;
  const requestedUrls = [];
  globalThis.fetch = async (url) => {
    requestedUrls.push(String(url));
    if (String(url).includes("/categories")) {
      return jsonResponse([{ id: "lighting" }]);
    }
    return jsonResponse({ total: 1, items: [{ id: "lamp-01" }] });
  };

  const { root } = installDomDocument();
  const reactRoot = createRoot(root);
  let latest = null;

  function ProductListProbe({ searchQuery }) {
    latest = useProductListData({
      apiBaseUrl: API_BASE_URL,
      activeFilters: createFilters(searchQuery),
      activeSort: "price",
    });
    return null;
  }

  try {
    await act(async () => {
      reactRoot.render(createElement(ProductListProbe, { searchQuery: "lamp" }));
    });
    const firstProductUrl = requestedUrls.find((url) => url.includes("/products"));
    assert.match(firstProductUrl, /search=lamp/);
    assert.match(firstProductUrl, /minPrice=10/);
    assert.match(firstProductUrl, /maxPrice=40/);
    assert.match(firstProductUrl, /categoryIds=lighting/);
    assert.match(firstProductUrl, /sortBy=price/);
    assert.equal(latest.availableCategories[0].id, "lighting");
    assert.equal(latest.fetchedProducts[0].id, "lamp-01");
    assert.equal(latest.isFetchingProducts, false);

    await act(async () => {
      reactRoot.render(createElement(ProductListProbe, { searchQuery: "mug" }));
    });
    const productUrls = requestedUrls.filter((url) => url.includes("/products"));
    assert.equal(productUrls.length, 2);
    assert.match(productUrls[1], /search=mug/);
  } finally {
    await act(async () => {
      reactRoot.unmount();
    });
    globalThis.fetch = originalFetch;
  }
});

testList("a non-array category body and a product body without items become empty lists", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes("/categories")) {
      return jsonResponse({ id: "not-a-list" });
    }
    return jsonResponse({ total: 0 });
  };

  const mounted = await mountProductList({
    apiBaseUrl: API_BASE_URL,
    activeFilters: createFilters(""),
    activeSort: "",
  });

  try {
    assert.deepEqual(mounted.read().availableCategories, []);
    assert.deepEqual(mounted.read().fetchedProducts, []);
    assert.equal(mounted.read().productsLoadError, null);
  } finally {
    await mounted.unmount();
    globalThis.fetch = originalFetch;
  }
});

testList("a failed product response sets the load error, and an abort does not", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes("/categories")) {
      return jsonResponse([]);
    }
    return jsonResponse({}, false);
  };

  const failed = await mountProductList({
    apiBaseUrl: API_BASE_URL,
    activeFilters: createFilters("lamp"),
    activeSort: "price",
  });

  try {
    assert.deepEqual(failed.read().fetchedProducts, []);
    assert.match(String(failed.read().productsLoadError), /fetchFilteredProducts - request failed: 500/);
    assert.equal(failed.read().isFetchingProducts, false);
  } finally {
    await failed.unmount();
  }

  const abortError = new Error("aborted");
  abortError.name = "AbortError";
  globalThis.fetch = async () => {
    throw abortError;
  };
  const aborted = await mountProductList({
    apiBaseUrl: API_BASE_URL,
    activeFilters: createFilters(""),
    activeSort: "",
  });

  try {
    assert.equal(aborted.read().productsLoadError, null);
    assert.deepEqual(aborted.read().fetchedProducts, []);
  } finally {
    await aborted.unmount();
    globalThis.fetch = originalFetch;
  }
});

testList("unmounting before the product response resolves drops the late payload", async () => {
  const originalFetch = globalThis.fetch;
  let resolveProducts = () => {};
  globalThis.fetch = (url) => {
    if (String(url).includes("/categories")) {
      return Promise.resolve(jsonResponse([]));
    }
    return new Promise((resolve) => {
      resolveProducts = () => resolve(jsonResponse({ items: [{ id: "late-product" }] }));
    });
  };

  const mounted = await mountProductList({
    apiBaseUrl: API_BASE_URL,
    activeFilters: createFilters("lamp"),
    activeSort: "",
  });

  try {
    await mounted.unmount();
    await act(async () => {
      resolveProducts();
      await Promise.resolve();
    });
    assert.deepEqual(mounted.read().fetchedProducts, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
