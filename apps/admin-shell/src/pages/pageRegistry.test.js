/**
 * Verifies which admin page each location shows, and when a visitor is redirected first.
 * Role: Locks the admin route table and its sign-in and role gates on every comparison branch.
 * Not in this file: Page rendering.
 * Key dependencies: node:test; src/pages/pageRegistry.js; test/support/loadAppModule.js.
 * See also: src/pages/pageRegistry.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import "../../../../test/support/installBrowserGlobals.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

const { resolvePageRoute } = await loadAppModule(new URL("./pageRegistry.js", import.meta.url).href);

const admin = { authToken: "token-01", currentUser: { id: "admin-01", role: "admin" } };
const customer = { authToken: "token-02", currentUser: { id: "user-01", role: "customer" } };
const guest = { authToken: null, currentUser: null };

test("an admin sees the page for each known path", () => {
  const expectedPages = {
    "/": "dashboard",
    "/orders": "orders",
    "/notifications": "notifications",
    "/posts": "posts",
    "/account": "account",
    "/order-details/order-01": "orderDetails",
  };
  for (const [pathname, page] of Object.entries(expectedPages)) {
    assert.deepEqual(resolvePageRoute({ pathname }, admin), { page }, pathname);
  }
  assert.deepEqual(resolvePageRoute({ pathname: "/posts/post-07" }, admin), {
    page: "singlePost",
    postId: "post-07",
  });
  assert.deepEqual(resolvePageRoute({ pathname: "/missing" }, admin), { page: "notFound" });
});

test("anyone may open the login page", () => {
  assert.deepEqual(resolvePageRoute({ pathname: "/login" }, guest), { page: "login" });
  assert.deepEqual(resolvePageRoute({ pathname: "/login" }, customer), { page: "login" });
});

test("a guest signs in first and comes back afterwards", () => {
  assert.deepEqual(resolvePageRoute({ pathname: "/orders", search: "?page=2" }, guest), {
    redirect: "/login",
    rememberPath: "/orders?page=2",
  });
  assert.deepEqual(
    resolvePageRoute({ pathname: "/", search: "" }, { authToken: "token-01", currentUser: null }),
    { redirect: "/login", rememberPath: "/" },
  );
});

test("a signed-in account without the admin role is turned away", () => {
  assert.deepEqual(resolvePageRoute({ pathname: "/orders" }, customer), {
    redirect: "/login",
    accessDenied: true,
  });
});
