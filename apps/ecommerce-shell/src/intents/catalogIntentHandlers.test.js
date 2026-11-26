/**
 * Verifies the shopper's catalog and cart requests change the cart, filters, and page the same way.
 * Role: Locks each catalog request outcome on every comparison branch.
 * Not in this file: How a request reaches the shell. Stock replies come from a recording transport.
 * Key dependencies: node:test; src/intents/catalogIntentHandlers.js; src/events/eventBus.js;
 *   test/support/createRecordingTransport.js; test/support/loadAppModule.js.
 * See also: src/intents/catalogIntentHandlers.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createRecordingTransport } from "../../../../test/support/createRecordingTransport.js";
import "../../../../test/support/installBrowserGlobals.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

const { installShellTransport, shellTransport: originalShellTransport } = await loadAppModule(
  new URL("../events/eventBus.js", import.meta.url).href,
);
const { STOCK_ISSUE_NOTIFICATION_MESSAGE } = await loadAppModule(
  new URL("../utils/cartActions.js", import.meta.url).href,
);
const { FILTER_STORAGE_KEY } = await loadAppModule(
  new URL("../utils/constants.js", import.meta.url).href,
);
const { createCatalogIntentHandlers, productDetailsPath } = await loadAppModule(
  new URL("./catalogIntentHandlers.js", import.meta.url).href,
);

/**
 * Builds shell state and handlers whose navigation and toasts are recorded.
 *
 * @param {object[]} [cartItems] - Lines already in the cart.
 * @returns {{ appState: object, handlers: object, paths: string[], notices: object[], renders: number[] }}
 */
function createShopperHandlers(cartItems = []) {
  const appState = {
    authToken: "token-01",
    currentUser: { id: "user-01" },
    cartItems,
    productsById: { mug: { name: "Mug", price: 10 } },
    plpFilters: { searchQuery: "", minPrice: "", maxPrice: "", categoryIds: [] },
    appliedCoupon: null,
  };
  const paths = [];
  const notices = [];
  const renders = [];
  const handlers = createCatalogIntentHandlers(appState, {
    navigate: (path) => paths.push(path),
    notify: (notice) => notices.push(notice),
    requestRender: () => renders.push(1),
  });
  return { appState, handlers, paths, notices, renders };
}

/**
 * Runs a callback with a scripted stock reply, then restores the shell transport.
 *
 * @param {object} requestReply - Stock outcome every request receives.
 * @param {() => Promise<void>} callback - Test body.
 * @returns {Promise<void>}
 */
async function withStockReply(requestReply, callback) {
  installShellTransport(createRecordingTransport({ requestReply }));
  try {
    await callback();
  } finally {
    installShellTransport(originalShellTransport);
  }
}

test("opening a product goes to its details page with an encoded id", () => {
  const { handlers, paths } = createShopperHandlers();
  handlers.onProductOpenRequested({ productId: "mug 01" });
  assert.deepEqual(paths, ["/product?productId=mug%2001"]);
  assert.equal(productDetailsPath("cup"), "/product?productId=cup");
});

test("applied filters are kept in shell state and storage", () => {
  const { appState, handlers } = createShopperHandlers();
  handlers.onFiltersApplyRequested({ searchQuery: "mug", categoryIds: ["kitchen"] });
  assert.equal(appState.plpFilters.searchQuery, "mug");
  assert.deepEqual(appState.plpFilters.categoryIds, ["kitchen"]);
  assert.equal(JSON.parse(localStorage.getItem(FILTER_STORAGE_KEY)).searchQuery, "mug");
});

test("a promotion applies its filters, and a promotion without filters clears them", () => {
  const { appState, handlers } = createShopperHandlers();
  handlers.onPromotionApplied({ filters: { minPrice: "5" } });
  assert.equal(appState.plpFilters.minPrice, "5");
  handlers.onPromotionApplied();
  assert.equal(appState.plpFilters.minPrice, "");
});

test("an add the stock allows lands in the cart and confirms by name", async () => {
  await withStockReply({ ok: true, quantity: 2, available: 3 }, async () => {
    const { appState, handlers, notices } = createShopperHandlers();
    const result = await handlers.onCartItemAddRequested({ productId: "mug", quantity: 2 });
    assert.equal(result.ok, true);
    assert.deepEqual(appState.cartItems, [{ productId: "mug", quantity: 2 }]);
    assert.deepEqual(notices, [
      { type: "success", title: "Item added", message: "Mug was added to your cart." },
    ]);
  });
});

test("an add the stock refuses leaves the cart and warns", async () => {
  await withStockReply({ ok: false, code: "insufficient" }, async () => {
    const { appState, handlers, notices } = createShopperHandlers();
    const result = await handlers.onCartItemAddRequested({ productId: "gone", quantity: 1 });
    assert.equal(result.ok, false);
    assert.deepEqual(appState.cartItems, []);
    assert.deepEqual(notices, [
      { type: "error", title: "Stock issue", message: STOCK_ISSUE_NOTIFICATION_MESSAGE },
    ]);
  });
});

test("an add of an unknown product confirms with a generic name", async () => {
  await withStockReply({ ok: true, quantity: 1, available: 1 }, async () => {
    const { handlers, notices } = createShopperHandlers();
    await handlers.onCartItemAddRequested({ productId: "gone", quantity: 1 });
    assert.equal(notices[0].message, "Item was added to your cart.");
  });
});

test("a quantity change follows the stock outcome", async () => {
  await withStockReply({ ok: true, quantity: 3, available: 2 }, async () => {
    const { appState, handlers, notices } = createShopperHandlers([{ productId: "mug", quantity: 1 }]);
    const result = await handlers.onCartItemUpdateRequested({ productId: "mug", quantity: 3 });
    assert.equal(result.available, 2);
    assert.deepEqual(appState.cartItems, [{ productId: "mug", quantity: 3 }]);
    assert.deepEqual(notices, []);
  });
  await withStockReply({ ok: false, code: "insufficient" }, async () => {
    const { appState, handlers, notices } = createShopperHandlers([{ productId: "mug", quantity: 1 }]);
    const result = await handlers.onCartItemUpdateRequested({ productId: "mug", quantity: 9 });
    assert.equal(result.ok, false);
    assert.deepEqual(appState.cartItems, [{ productId: "mug", quantity: 1 }]);
    assert.equal(notices[0].title, "Stock issue");
  });
});

test("a removal empties the line and confirms, and a refused removal keeps it", async () => {
  await withStockReply({ ok: true, quantity: 0, available: 5 }, async () => {
    const { appState, handlers, notices, renders } = createShopperHandlers([{ productId: "mug", quantity: 1 }]);
    const result = await handlers.onCartItemRemoveRequested({ productId: "mug" });
    assert.equal(result.ok, true);
    assert.deepEqual(appState.cartItems, []);
    assert.equal(renders.length, 1);
    assert.deepEqual(notices, [
      { type: "success", title: "Item removed", message: "Mug was removed from your cart." },
    ]);
  });
  await withStockReply({ ok: false, code: "unavailable" }, async () => {
    const { appState, handlers, notices } = createShopperHandlers([{ productId: "mug", quantity: 1 }]);
    await handlers.onCartItemRemoveRequested({ productId: "mug" });
    assert.deepEqual(appState.cartItems, [{ productId: "mug", quantity: 1 }]);
    assert.equal(notices[0].title, "Stock issue");
  });
});

test("removing one of several lines keeps the checkout list without a re-render", async () => {
  await withStockReply({ ok: true, quantity: 0, available: 5 }, async () => {
    const { appState, handlers, renders } = createShopperHandlers([
      { productId: "mug", quantity: 1 },
      { productId: "cup", quantity: 2 },
    ]);
    await handlers.onCartItemRemoveRequested({ productId: "mug" });
    assert.deepEqual(appState.cartItems, [{ productId: "cup", quantity: 2 }]);
    assert.deepEqual(renders, []);
  });
});
