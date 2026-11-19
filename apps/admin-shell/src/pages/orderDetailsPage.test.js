/**
 * Verifies the admin order details page reads the order id and offers a way back.
 * Role: Locks the heading, missing-id message, and back navigation.
 * Not in this file: The order details remote.
 * Key dependencies: node:test; src/pages/orderDetailsPage.js; test/support/createPageDocument.js.
 * See also: src/pages/orderDetailsPage.js.
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
const { renderOrderDetailsPage, readOrderIdFromPath } = await loadAppModule(
  new URL("./orderDetailsPage.js", import.meta.url).href,
);

test("reads an order id only from an order details path", () => {
  assert.equal(readOrderIdFromPath("/orders"), "");
  assert.equal(readOrderIdFromPath("/order-details/"), "");
  assert.equal(readOrderIdFromPath("/order-details/ord-01/extra"), "");
  assert.equal(readOrderIdFromPath("/order-details/%"), "");
  assert.equal(readOrderIdFromPath("/order-details/ord%201"), "ord 1");
});

test("explains a missing order id and returns to the orders list", async () => {
  resetLocation("/orders");
  const pageRoot = createPageRoot();
  const cleanups = [];
  await renderOrderDetailsPage({ authToken: "token-01" }, pageRoot, createRemoteRecorder(), cleanups);
  assert.match(pageRoot.textContent, /No order id was provided/);

  resetLocation("/orders");
  pageRoot.querySelector("#backToOrdersButton").click();
  assert.equal(window.location.pathname, "/orders");
  cleanups.forEach((cleanup) => cleanup());
  resetLocation("/stay");
  pageRoot.querySelector("#backToOrdersButton").click();
  assert.equal(window.location.pathname, "/stay");
});

test("mounts the order for the id in the address", async () => {
  resetLocation("/order-details/ord-01");
  const pageRoot = createPageRoot();
  const remotes = createRemoteRecorder();
  await renderOrderDetailsPage({ authToken: "token-01" }, pageRoot, remotes, []);
  const mountedOrder = latestRemoteCall(remotes, "orderDetails");
  assert.equal(mountedOrder.props.actor, "admin");
  assert.equal(mountedOrder.props.authToken, "token-01");
  assert.equal(mountedOrder.props.buildOrderRequestPath("ord-01"), "/admin/orders/ord-01");
  assert.match(pageRoot.textContent, /Order Details/);
  await invokeHandler(mountedOrder.props, "onStatusRejected");
  assert.match(pageRoot.textContent, /Order Details/);
});
