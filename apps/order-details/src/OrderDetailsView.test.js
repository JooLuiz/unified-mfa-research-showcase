/**
 * Verifies the order details page text for loading, missing, failed, and loaded orders.
 * Role: Locks the copy a shopper or admin sees for each load outcome and for a loaded order's sections.
 * Not in this file: Status actions per actor (see order-details-renderers.test.js) or composable state.
 * Key dependencies: node:test; vue; src/OrderDetailsView.js; test/support/mountVueComponent.js.
 * See also: src/OrderDetailsView.js; src/useOrderDetails.test.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import "../../../test/support/installBrowserGlobals.js";
import { findElement } from "../../../test/support/installDomDocument.js";
import { loadAppModule } from "../../../test/support/loadAppModule.js";
import { mountVueComponent } from "../../../test/support/mountVueComponent.js";

const { nextTick } = await import("vue");
const { OrderDetailsComponent } = await loadAppModule(new URL("./OrderDetailsView.js", import.meta.url).href);

const API_BASE_URL = "http://localhost:4000";

/** Lets pending fetch promises settle and Vue flush. */
async function flushRequests() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  await nextTick();
}

/**
 * Mounts the page for an order path with a stand-in fetch, then restores fetch and path.
 *
 * @param {(url: string) => Promise<object>} fetchStub - Stand-in fetch.
 * @param {(root: object) => Promise<void>} run - Assertions against the mounted page.
 * @param {string} [pathname] - Page path.
 * @returns {Promise<void>}
 */
async function withOrderPage(fetchStub, run, pathname = "/order-details/order-01") {
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  globalThis.fetch = fetchStub;
  console.warn = () => {};
  window.location.pathname = pathname;
  const mounted = await mountVueComponent(OrderDetailsComponent, { apiBaseUrl: API_BASE_URL });
  try {
    await run(mounted.root);
  } finally {
    mounted.unmount();
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
    window.location.pathname = "/";
  }
}

for (const [status, copy] of [
  [403, "This order belongs to another account."],
  [404, "Order not found."],
  [500, "Unable to load order details."],
]) {
  test(`a ${status} reply shows "${copy}"`, async () => {
    await withOrderPage(async () => ({ ok: false, status, statusText: "Error", json: async () => ({}) }), async (root) => {
      await flushRequests();
      assert.equal(root.textContent, copy);
    });
  });
}

test("a pending load shows Loading order, and a path without an id says so", async () => {
  await withOrderPage(() => new Promise(() => {}), async (root) => {
    await flushRequests();
    assert.equal(root.textContent, "Loading order...");
  });
  await withOrderPage(async () => ({}), async (root) => {
    await flushRequests();
    assert.equal(root.textContent, "No order id was provided.");
  }, "/orders");
});

test("no API base URL and no order shows Order not found", async () => {
  const mounted = await mountVueComponent(OrderDetailsComponent, {});
  try {
    assert.equal(mounted.root.textContent, "Order not found.");
  } finally {
    mounted.unmount();
  }
});

test("a loaded order shows its items, coupon, discount, and shipping address", async () => {
  const mounted = await mountVueComponent(OrderDetailsComponent, {
    order: {
      id: "order-01",
      status: "shipped",
      placedAt: "2026-03-01T12:00:00.000Z",
      items: [
        { productId: "mug", name: "Blue Mug", quantity: 2, unitPrice: 10 },
        { productId: "lamp", quantity: 1, unitPrice: 30 },
      ],
      subtotal: 50,
      discountAmount: 5,
      totalAmount: 45,
      appliedCoupon: { code: "SAVE10" },
      shippingAddress: { street: "1 Main St", city: "London", postalCode: "N1", country: "UK" },
    },
  });

  try {
    const text = mounted.root.textContent;
    assert.match(text, /Order order-01/);
    assert.match(text, /Blue Mug/);
    assert.match(text, /lamp/);
    assert.match(text, /\$20\.00/);
    assert.match(text, /SAVE10 \(-\$5\.00\)/);
    assert.match(text, /Discount:-\$5\.00/);
    assert.match(text, /Shipping address/);
    assert.match(text, /1 Main St/);
    assert.match(text, /London/);
    assert.match(text, /N1 - UK/);
  } finally {
    mounted.unmount();
  }
});

test("an order with no items, coupon, discount, status, or address shows only the basics", async () => {
  const mounted = await mountVueComponent(OrderDetailsComponent, {
    order: { id: "order-02", subtotal: "n/a", totalAmount: 0 },
  });

  try {
    const text = mounted.root.textContent;
    assert.match(text, /Order order-02/);
    assert.match(text, /Placed on -/);
    assert.match(text, /None/);
    assert.match(text, /\$0\.00/);
    assert.doesNotMatch(text, /Discount:/);
    assert.doesNotMatch(text, /Shipping address/);
    assert.equal(findElement(mounted.root, (node) => node.nodeName === "TABLE"), null);
    assert.match(text, /Request cancellation/);
  } finally {
    mounted.unmount();
  }
});
