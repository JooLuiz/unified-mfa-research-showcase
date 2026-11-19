/**
 * Verifies the admin orders table lists customers and opens an order from a row.
 * Role: Locks the orders page text and the path a row click opens.
 * Not in this file: Live order delivery.
 * Key dependencies: node:test; src/pages/ordersPage.js; test/support/createPageDocument.js.
 * See also: src/pages/ordersPage.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import "../../../../test/support/installBrowserGlobals.js";
import {
  installFetch,
  installPageDocument,
  resetLocation,
} from "../../../../test/support/createPageDocument.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

const { createPageRoot } = await installPageDocument();
const { renderOrdersPage } = await loadAppModule(new URL("./ordersPage.js", import.meta.url).href);

/**
 * Builds an admin session the orders page can send with its request.
 *
 * @returns {object} Shell state.
 */
function createAdmin() {
  return { authToken: "token-01", currentUser: { role: "admin" } };
}

test("shows each order and opens it when the row is clicked", async () => {
  installFetch((url) => {
    if (url.includes("/admin/orders")) {
      return {
        body: {
          items: [
            {
              id: "ord-01",
              customer: { fullName: "Ada Lovelace" },
              placedAt: "2026-03-04T12:00:00.000Z",
              items: [{ quantity: 1 }],
              totalAmount: 10,
              status: "placed",
            },
            {
              id: "",
              customer: { username: "blank" },
              placedAt: "2026-03-05T12:00:00.000Z",
              items: [],
              totalAmount: 0,
              status: "placed",
            },
          ],
        },
      };
    }
    return { body: {} };
  });
  resetLocation("/orders");
  const pageRoot = createPageRoot();
  const cleanups = [];
  await renderOrdersPage(createAdmin(), pageRoot, cleanups);

  assert.match(pageRoot.textContent, /Ada Lovelace/);
  pageRoot.querySelector("th").click();
  assert.equal(window.location.pathname, "/orders");
  pageRoot.querySelector("tr[data-order-id='']").click();
  assert.equal(window.location.pathname, "/orders");
  pageRoot.querySelector("tr[data-order-id='ord-01'] td").click();
  assert.equal(window.location.pathname, "/order-details/ord-01");

  resetLocation("/orders");
  cleanups.forEach((cleanup) => cleanup());
  pageRoot.querySelector("tr[data-order-id='ord-01'] td").click();
  assert.equal(window.location.pathname, "/orders");
});

test("shows an empty message when the payload has no order list", async () => {
  installFetch(() => ({ body: { items: null } }));
  const pageRoot = createPageRoot();
  await renderOrdersPage(createAdmin(), pageRoot, []);
  assert.match(pageRoot.textContent, /No orders found/);
});

test("shows an error when orders cannot be loaded", async () => {
  installFetch(() => ({ throwError: new Error("orders down") }));
  const pageRoot = createPageRoot();
  await renderOrdersPage(createAdmin(), pageRoot, []);
  assert.match(pageRoot.textContent, /Unable to load orders/);
});
