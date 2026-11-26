/**
 * Verifies the product list page a shopper sees for provided products, categories, and filters.
 * Role: Locks the category tag for an active filter, the empty grid, one card slot per product, and load more.
 * Not in this file: Filter state rules (see hooks/useProductListFilters.test.js) or product requests.
 * Key dependencies: node:test; react; src/ProductListView.js; scripts/test/jsxLoader.mjs; test/support/installDomDocument.js.
 * See also: src/ProductListView.js; src/components/ProductGrid.js.
 */

import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import "../../../test/support/installBrowserGlobals.js";
import { findElement, installDomDocument } from "../../../test/support/installDomDocument.js";
import { loadAppModule } from "../../../test/support/loadAppModule.js";

const jsxLoader = register(new URL("../../../scripts/test/jsxLoader.mjs", import.meta.url), import.meta.url);
if (jsxLoader && typeof jsxLoader.then === "function") {
  await jsxLoader;
}

const { ProductListView } = await loadAppModule(new URL("./ProductListView.js", import.meta.url).href);

const categories = [
  { id: "lighting", name: "Lighting" },
  { id: "desks", name: "Desks" },
];

/**
 * Mounts the page with provided data, so no product or category request is sent.
 *
 * @param {object} props - View props.
 * @returns {Promise<{ root: object, unmount: () => Promise<void> }>} Mounted page.
 */
async function mountView(props) {
  const { root } = installDomDocument();
  // The sort <select> needs `options`, which the shared fake DOM does not model.
  const createElementNode = document.createElement;
  document.createElement = (tagName) => {
    const element = createElementNode(tagName);
    if (String(tagName).toLowerCase() === "select") {
      Object.defineProperty(element, "options", { get: () => element.childNodes });
    }
    return element;
  };
  const reactRoot = createRoot(root);
  await act(async () => {
    reactRoot.render(createElement(ProductListView, props));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return {
    root,
    async unmount() {
      await act(async () => {
        reactRoot.unmount();
      });
    },
  };
}

/**
 * Counts the product card slots on the page.
 *
 * @param {object} node - Page root.
 * @returns {number} Number of card slots.
 */
function countCardSlots(node) {
  const own = String(node.nodeName).toLowerCase() === "vue-product-card" ? 1 : 0;
  return own + (node.childNodes || []).reduce((total, child) => total + countCardSlots(child), 0);
}

test("an active category shows its tag, and an empty product list shows no cards", async (testContext) => {
  testContext.mock.method(console, "warn", () => {});
  const mounted = await mountView({
    products: [],
    categories,
    initialFilters: { searchQuery: "", minPrice: "", maxPrice: "", categoryIds: ["lighting"] },
  });

  try {
    assert.match(mounted.root.textContent, /Lighting/);
    assert.equal(countCardSlots(mounted.root), 0);
    assert.equal(
      findElement(mounted.root, (node) => node.classList && node.classList.contains("product-load-more-button")),
      null,
    );
  } finally {
    await mounted.unmount();
  }
});

test("provided products render one card slot each and offer load more past the first rows", async (testContext) => {
  testContext.mock.method(console, "warn", () => {});
  const originalWidth = window.innerWidth;
  window.innerWidth = 1280;
  const products = Array.from({ length: 30 }, (_value, index) => ({ id: `p-${index}`, name: `Product ${index}`, price: 1 }));
  const mounted = await mountView({ products, categories, initialFilters: {} });

  try {
    const shownBefore = countCardSlots(mounted.root);
    assert.equal(shownBefore > 0 && shownBefore < products.length, true);
    const loadMore = findElement(
      mounted.root,
      (node) => node.classList && node.classList.contains("product-load-more-button"),
    );
    await act(async () => {
      loadMore.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    assert.equal(countCardSlots(mounted.root) > shownBefore, true);
  } finally {
    await mounted.unmount();
    window.innerWidth = originalWidth;
  }
});
