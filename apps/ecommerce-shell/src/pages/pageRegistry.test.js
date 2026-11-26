/**
 * Verifies which ecommerce page each location shows, and when a shopper is redirected first.
 * Role: Locks the shell's route table on every comparison branch.
 * Not in this file: Page rendering.
 * Key dependencies: node:test; src/pages/pageRegistry.js; test/support/loadAppModule.js.
 * See also: src/pages/pageRegistry.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import "../../../../test/support/installBrowserGlobals.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

const { resolvePageRoute } = await loadAppModule(new URL("./pageRegistry.js", import.meta.url).href);

const guest = { authToken: null, currentUser: null };
const shopper = { authToken: "token-01", currentUser: { id: "user-01" } };

test("each known path shows its page", () => {
  const expectedPages = {
    "/": "home",
    "/products": "products",
    "/promotions": "promotions",
    "/product": "productDetails",
    "/order-placed": "orderPlaced",
    "/login": "login",
    "/notifications": "notifications",
    "/checkout": "checkout",
    "/account": "account",
    "/order-details/order-01": "orderDetails",
  };
  for (const [pathname, page] of Object.entries(expectedPages)) {
    assert.deepEqual(resolvePageRoute({ pathname, search: "" }, shopper), { page }, pathname);
  }
});

test("an unknown path, or an order path with extra segments, is not found", () => {
  assert.deepEqual(resolvePageRoute({ pathname: "/missing" }, shopper), { page: "notFound" });
  assert.deepEqual(resolvePageRoute({ pathname: "/order-details/a/b" }, shopper), {
    page: "notFound",
  });
  assert.deepEqual(resolvePageRoute({ pathname: "/order-details", search: "" }, shopper), {
    page: "notFound",
  });
});

test("a legacy order link moves to the order's own path", () => {
  assert.deepEqual(
    resolvePageRoute({ pathname: "/order-details", search: "?orderId=order 01" }, guest),
    { redirect: "/order-details/order%2001" },
  );
});

test("a guest on a protected page signs in first and comes back afterwards", () => {
  assert.deepEqual(resolvePageRoute({ pathname: "/checkout", search: "?step=2" }, guest), {
    redirect: "/login",
    rememberPath: "/checkout?step=2",
  });
  assert.deepEqual(resolvePageRoute({ pathname: "/order-details/order-01" }, guest), {
    redirect: "/login",
    rememberPath: "/order-details/order-01",
  });
});
