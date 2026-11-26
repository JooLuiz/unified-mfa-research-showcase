/**
 * Verifies product card states when stock, product data, or layout options are missing.
 * Role: Locks quantity limits without a stock count, typed quantities, unmount during a load,
 *   the compact layout, and hidden quantity controls.
 * Not in this file: Price, image, and failed-load states (see product-card-component.test.js).
 * Key dependencies: node:test; vue; src/product-card-component.js; test/support/installDomDocument.js; test/support/loadAppModule.js.
 * See also: src/product-card-component.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import "../../../test/support/installBrowserGlobals.js";
import { findElement, installDomDocument } from "../../../test/support/installDomDocument.js";
import { loadAppModule } from "../../../test/support/loadAppModule.js";

installDomDocument();
const { createApp, nextTick } = await import("vue");
const { ProductCardComponent } = await loadAppModule(
  new URL("./product-card-component.js", import.meta.url).href,
);

/**
 * Mounts one product card.
 *
 * @param {object} props - Component props.
 * @returns {Promise<{ root: object, unmount: () => void }>} The mounted card.
 */
async function mountCard(props) {
  const { root } = installDomDocument();
  const app = createApp(ProductCardComponent, props);
  app.mount(root);
  await nextTick();
  return { root, unmount: () => app.unmount() };
}

/**
 * Finds the first element with a class.
 *
 * @param {object} root - Mounted card root.
 * @param {string} className - Class to match.
 * @returns {object | null} The element, or null.
 */
function findByClass(root, className) {
  return findElement(root, (node) => node.classList && node.classList.contains(className));
}

/**
 * Dispatches an event on a node and waits for the render.
 *
 * @param {object} node - Target node.
 * @param {string} type - Event type.
 * @returns {Promise<void>}
 */
async function fire(node, type) {
  node.dispatchEvent(new MouseEvent(type, { bubbles: true }));
  await nextTick();
}

const productWithoutStock = { id: "mug", name: "Mug", price: 12, image: "mug.png" };

test("a product with no stock count shows no availability and no quantity limit", async () => {
  const mounted = await mountCard({ product: productWithoutStock, defaultQuantity: 0 });

  try {
    assert.doesNotMatch(mounted.root.textContent, /available/);
    const input = findByClass(mounted.root, "quantity-value-input");
    assert.equal(String(input.value), "1");
    assert.equal(input.getAttribute("max"), null);

    const plusButton = findElement(
      mounted.root,
      (node) => node.classList && node.classList.contains("quantity-control-button") && node.textContent === "+",
    );
    await fire(plusButton, "click");
    await fire(plusButton, "click");
    assert.equal(String(findByClass(mounted.root, "quantity-value-input").value), "3");
  } finally {
    mounted.unmount();
  }
});

test("a typed quantity is clamped to the stock count, and an invalid one becomes 1", async () => {
  const added = [];
  const mounted = await mountCard({
    product: { ...productWithoutStock, available: 3 },
    onAddToCart: (payload) => added.push(payload),
  });

  try {
    const input = findByClass(mounted.root, "quantity-value-input");
    input.value = "9";
    await fire(input, "change");
    assert.equal(String(input.value), "3");

    input.value = "abc";
    await fire(input, "change");
    assert.equal(String(input.value), "1");

    input.value = "2";
    await fire(input, "change");
    await fire(findByClass(mounted.root, "add-cart-button"), "click");
    assert.deepEqual(added, [{ productId: "mug", quantity: 2 }]);
  } finally {
    mounted.unmount();
  }
});

test("hidden quantity controls always add one", async () => {
  const added = [];
  const mounted = await mountCard({
    product: { ...productWithoutStock, available: 5 },
    defaultQuantity: 4,
    hideQuantity: true,
    onAddToCart: (payload) => added.push(payload),
  });

  try {
    assert.equal(findByClass(mounted.root, "quantity-value-input"), null);
    await fire(findByClass(mounted.root, "add-cart-button"), "click");
    assert.deepEqual(added, [{ productId: "mug", quantity: 1 }]);
  } finally {
    mounted.unmount();
  }
});

test("the compact card shows the name and hides the add button when out of stock", async () => {
  const added = [];
  const opened = [];
  const inStock = await mountCard({
    product: { ...productWithoutStock, available: 2 },
    variant: "compact",
    actionLabel: "Buy",
    onAddToCart: (payload) => added.push(payload),
    onProductClick: (productId) => opened.push(productId),
  });
  const outOfStock = await mountCard({ product: { ...productWithoutStock, available: 0 }, variant: "compact" });

  try {
    assert.match(inStock.root.textContent, /Mug/);
    assert.match(inStock.root.textContent, /2 available/);
    assert.equal(findByClass(inStock.root, "quantity-value-input"), null);
    await fire(findByClass(inStock.root, "card-compact-image"), "click");
    await fire(findByClass(inStock.root, "add-cart-button"), "click");
    assert.deepEqual(opened, ["mug"]);
    assert.deepEqual(added, [{ productId: "mug", quantity: 1 }]);

    assert.match(outOfStock.root.textContent, /Out of stock/);
    assert.equal(findByClass(outOfStock.root, "add-cart-button"), null);
  } finally {
    inStock.unmount();
    outOfStock.unmount();
  }
});

test("a card with no product, product id, or API URL shows Product unavailable", async () => {
  const mounted = await mountCard({ productId: "mug" });

  try {
    assert.match(mounted.root.textContent, /Product unavailable\./);
  } finally {
    mounted.unmount();
  }
});

test("a product reply that arrives after unmount changes nothing", async () => {
  const originalFetch = globalThis.fetch;
  let resolveReply;
  let requestSignal;
  globalThis.fetch = (_url, options) => {
    requestSignal = options.signal;
    return new Promise((resolve) => {
      resolveReply = resolve;
    });
  };

  try {
    const mounted = await mountCard({ productId: "mug", apiBaseUrl: "http://api" });
    assert.match(mounted.root.textContent, /Loading product/);
    mounted.unmount();
    assert.equal(requestSignal.aborted, true);

    resolveReply({ ok: true, json: async () => productWithoutStock });
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.doesNotMatch(mounted.root.textContent, /Mug/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
