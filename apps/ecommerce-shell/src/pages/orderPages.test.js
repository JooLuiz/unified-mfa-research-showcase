/**
 * Verifies the ecommerce order details page asks a guest to sign in and mounts an order otherwise.
 * Role: Locks the login redirect, the heading, and the return to account.
 * Not in this file: Order fetching inside the order details remote.
 * Key dependencies: node:test; src/pages/orderPages.js; test/support/createPageDocument.js.
 * See also: src/pages/orderPages.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import "../../../../test/support/installBrowserGlobals.js";
import {
  createRemoteRecorder,
  installPageDocument,
  invokeHandler,
  latestRemoteCall,
  resetLocation,
} from "../../../../test/support/createPageDocument.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

const { createPageRoot } = await installPageDocument();
const { renderOrderDetailsPage } = await loadAppModule(new URL("./orderPages.js", import.meta.url).href);

test("sends a guest to login from the order they tried to open", async () => {
  resetLocation("/order-details/ord-01", "?from=mail");
  const pageRoot = createPageRoot();
  await renderOrderDetailsPage({ authToken: "", currentUser: null }, pageRoot, createRemoteRecorder(), []);
  assert.equal(window.location.pathname, "/login");
  assert.equal(pageRoot.querySelector("#orderDetailsMount"), null);
});

test("shows the order and returns to the account page", async () => {
  resetLocation("/order-details/ord-01");
  const pageRoot = createPageRoot();
  const remotes = createRemoteRecorder();
  await renderOrderDetailsPage(
    { authToken: "token-01", currentUser: { id: "user-01" } },
    pageRoot,
    remotes,
    [],
  );
  assert.match(pageRoot.textContent, /Order Details/);
  assert.equal(latestRemoteCall(remotes, "orderDetails").props.actor, "customer");
  await invokeHandler(latestRemoteCall(remotes, "orderDetails").props, "onStatusRejected");
  pageRoot.querySelector("#backToAccountButton").click();
  assert.equal(window.location.pathname, "/account");
});
