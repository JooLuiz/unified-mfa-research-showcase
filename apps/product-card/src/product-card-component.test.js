/**
 * Verifies the product card states a shopper can see.
 * Role: Locks missing price, missing image, unavailable, and add-to-cart for a provided product.
 * Not in this file: How availability updates arrive after the card has loaded.
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
 * Mounts one product card for a provided product and no API base URL.
 *
 * @param {object} props - Component props. apiBaseUrl stays empty so the card does not open a stock watch.
 * @returns {Promise<{ root: object, unmount: () => void }>} The mounted card.
 */
async function mountCard(props) {
  const { root } = installDomDocument();
  const app = createApp(ProductCardComponent, props);
  app.mount(root);
  await nextTick();
  return {
    root,
    unmount() {
      app.unmount();
    },
  };
}

/**
 * Finds the add-to-cart button, when the card rendered one.
 *
 * @param {object} root - Mounted card root.
 * @returns {object | null} The button, or null.
 */
function findAddButton(root) {
  return findElement(
    root,
    (node) => node.classList && node.classList.contains("add-cart-button"),
  );
}

test("a missing price renders $NaN", async () => {
  const mounted = await mountCard({
    product: { id: "mug", name: "Mug", image: "mug.png", available: 4 },
  });

  try {
    assert.match(mounted.root.textContent, /\$NaN/);
    assert.match(mounted.root.textContent, /Mug/);
  } finally {
    mounted.unmount();
  }
});

test("a missing image still renders the product name", async () => {
  const mounted = await mountCard({
    product: { id: "mug", name: "Mug", price: 12, available: 4 },
  });

  try {
    const image = findElement(mounted.root, (node) => node.nodeName === "IMG");
    assert.equal(image.getAttribute("src") || "", "");
    assert.match(mounted.root.textContent, /Mug/);
  } finally {
    mounted.unmount();
  }
});

test("an unavailable product renders Out of stock and no add button", async () => {
  const mounted = await mountCard({
    product: { id: "mug", name: "Mug", price: 12, image: "mug.png", available: 0 },
  });

  try {
    assert.match(mounted.root.textContent, /Out of stock/);
    assert.equal(findAddButton(mounted.root), null);
  } finally {
    mounted.unmount();
  }
});

test("add to cart reports the product id and the selected quantity once", async () => {
  const added = [];
  const mounted = await mountCard({
    product: { id: "mug", name: "Mug", price: 12, image: "mug.png", available: 4 },
    defaultQuantity: 2,
    onAddToCart(payload) {
      added.push(payload);
    },
  });

  try {
    const addButton = findAddButton(mounted.root);
    addButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    assert.deepEqual(added, [{ productId: "mug", quantity: 2 }]);
  } finally {
    mounted.unmount();
  }
});
