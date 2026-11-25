/**
 * Verifies the product card states a shopper can see.
 * Role: Locks missing price, missing image, unavailable, add-to-cart, failed and replaced loads, and quantity limits.
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
const { createApp, h, nextTick, reactive } = await import("vue");
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

/**
 * Mounts a card whose props can change after mount.
 *
 * @param {object} initialProps - Starting props.
 * @returns {Promise<{ root: object, state: object, unmount: () => void }>} The mounted card and its reactive props.
 */
async function mountReactiveCard(initialProps) {
  const { root } = installDomDocument();
  const state = reactive({ ...initialProps });
  const app = createApp({ render: () => h(ProductCardComponent, { ...state }) });
  app.mount(root);
  await nextTick();
  return {
    root,
    state,
    unmount() {
      app.unmount();
    },
  };
}

/** Lets pending fetch promises settle and Vue re-render. */
async function flushRequests() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}

/**
 * Replaces fetch for one test and restores it afterwards.
 *
 * @param {(url: string, options: object) => Promise<object>} fetchStub - Stand-in fetch.
 * @param {() => Promise<void>} run - Test body.
 * @returns {Promise<void>}
 */
async function withFetch(fetchStub, run) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchStub;
  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

/**
 * Clicks the quantity button with the given text and waits for the render.
 *
 * @param {object} root - Mounted card root.
 * @param {"-" | "+"} label - Button text.
 * @returns {Promise<void>}
 */
async function clickQuantity(root, label) {
  const button = findElement(
    root,
    (node) =>
      node.classList && node.classList.contains("quantity-control-button") && node.textContent === label,
  );
  button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await nextTick();
}

/**
 * Reads the selected quantity.
 *
 * @param {object} root - Mounted card root.
 * @returns {string} Quantity input value.
 */
function readQuantity(root) {
  const input = findElement(
    root,
    (node) => node.classList && node.classList.contains("quantity-value-input"),
  );
  return String(input.value);
}

test("a failed product request shows Product unavailable", async () => {
  await withFetch(async () => ({ ok: false, status: 500, statusText: "Error", json: async () => ({}) }), async () => {
    const mounted = await mountCard({ productId: "mug", apiBaseUrl: "http://api" });
    try {
      await flushRequests();
      assert.match(mounted.root.textContent, /Product unavailable\./);
    } finally {
      mounted.unmount();
    }
  });
});

test("a new product id cancels the pending load and requests the new product", async () => {
  const requests = [];
  await withFetch((url, options) => {
    requests.push({ url: String(url), signal: options.signal });
    if (requests.length === 1) {
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => {
          const abortError = new Error("aborted");
          abortError.name = "AbortError";
          reject(abortError);
        });
      });
    }
    return Promise.resolve({ ok: false, status: 404, statusText: "Not Found", json: async () => ({}) });
  }, async () => {
    const mounted = await mountReactiveCard({ productId: "mug", apiBaseUrl: "http://api" });
    try {
      mounted.state.productId = "lamp";
      await nextTick();
      await flushRequests();
      assert.equal(requests[0].signal.aborted, true);
      assert.match(requests[1].url, /\/products\/lamp$/);
      assert.match(mounted.root.textContent, /Product unavailable\./);
    } finally {
      mounted.unmount();
    }
  });
});

test("a new product resets the selected quantity", async () => {
  const mounted = await mountReactiveCard({
    product: { id: "mug", name: "Mug", price: 12, image: "mug.png", available: 4 },
    defaultQuantity: 1,
  });

  try {
    await clickQuantity(mounted.root, "+");
    await clickQuantity(mounted.root, "+");
    assert.equal(readQuantity(mounted.root), "3");

    mounted.state.product = { id: "lamp", name: "Lamp", price: 30, image: "lamp.png", available: 4 };
    await nextTick();
    await nextTick();
    assert.match(mounted.root.textContent, /Lamp/);
    assert.equal(readQuantity(mounted.root), "1");
  } finally {
    mounted.unmount();
  }
});

test("decrement never goes below 1", async () => {
  const mounted = await mountCard({
    product: { id: "mug", name: "Mug", price: 12, image: "mug.png", available: 4 },
  });

  try {
    await clickQuantity(mounted.root, "-");
    await clickQuantity(mounted.root, "-");
    assert.equal(readQuantity(mounted.root), "1");
  } finally {
    mounted.unmount();
  }
});
