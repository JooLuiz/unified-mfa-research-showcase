/**
 * Verifies product and promotion requests open the matching ecommerce page.
 * Role: Locks the ecommerce URLs the social shell sends a member to on every comparison branch.
 * Not in this file: How a request reaches the shell.
 * Key dependencies: node:test; src/intents/catalogIntentHandlers.js; test/support/loadAppModule.js.
 * See also: src/intents/catalogIntentHandlers.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import "../../../../test/support/installBrowserGlobals.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

const { ECOMMERCE_SHELL_BASE_URL } = await loadAppModule(
  new URL("../utils/constants.js", import.meta.url).href,
);
const { buildEcommerceProductsUrl, createCatalogIntentHandlers } = await loadAppModule(
  new URL("./catalogIntentHandlers.js", import.meta.url).href,
);

/**
 * Builds handlers whose page changes are recorded.
 *
 * @returns {{ handlers: object, openedUrls: string[] }}
 */
function createRecordedHandlers() {
  const openedUrls = [];
  const handlers = createCatalogIntentHandlers({ assignLocation: (url) => openedUrls.push(url) });
  return { handlers, openedUrls };
}

test("opening or adding a product opens its ecommerce details page", () => {
  const { handlers, openedUrls } = createRecordedHandlers();
  handlers.onProductOpenRequested({ productId: "mug 01" });
  handlers.onCartItemAddRequested({ productId: "cup" });
  assert.deepEqual(openedUrls, [
    `${ECOMMERCE_SHELL_BASE_URL}/product?productId=mug%2001`,
    `${ECOMMERCE_SHELL_BASE_URL}/product?productId=cup`,
  ]);
});

test("a promotion opens the product list with its filters", () => {
  const { handlers, openedUrls } = createRecordedHandlers();
  handlers.onPromotionApplied({
    filters: { searchQuery: "mug", minPrice: "5", maxPrice: "20", categoryIds: ["a", "b"] },
  });
  assert.deepEqual(openedUrls, [
    `${ECOMMERCE_SHELL_BASE_URL}/products?searchQuery=mug&minPrice=5&maxPrice=20&categoryIds=a%2Cb`,
  ]);
});

test("a promotion with one filter adds only that filter to the product list URL", () => {
  const cases = [
    [{ searchQuery: "hat" }, "?searchQuery=hat"],
    [{ minPrice: "1" }, "?minPrice=1"],
    [{ maxPrice: "9" }, "?maxPrice=9"],
  ];
  for (const [filters, search] of cases) {
    assert.equal(buildEcommerceProductsUrl(filters), `${ECOMMERCE_SHELL_BASE_URL}/products${search}`);
  }
});

test("a promotion without filters opens the plain product list", () => {
  const { handlers, openedUrls } = createRecordedHandlers();
  handlers.onPromotionApplied();
  handlers.onPromotionApplied({ filters: { categoryIds: [] } });
  assert.deepEqual(openedUrls, [
    `${ECOMMERCE_SHELL_BASE_URL}/products`,
    `${ECOMMERCE_SHELL_BASE_URL}/products`,
  ]);
  assert.equal(buildEcommerceProductsUrl(null), `${ECOMMERCE_SHELL_BASE_URL}/products`);
});

test("the default handlers leave the page through window.location", () => {
  const originalAssign = window.location.assign;
  const assigned = [];
  window.location.assign = (url) => assigned.push(url);
  try {
    createCatalogIntentHandlers().onProductOpenRequested({ productId: "mug" });
  } finally {
    window.location.assign = originalAssign;
  }
  assert.deepEqual(assigned, [`${ECOMMERCE_SHELL_BASE_URL}/product?productId=mug`]);
});
