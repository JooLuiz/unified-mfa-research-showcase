/**
 * Verifies the ecommerce account page, sign-out, and the shopper's order list.
 * Role: Locks account text, order rows, and the order a row opens.
 * Not in this file: Live order status delivery.
 * Key dependencies: node:test; src/pages/accountPage.js; test/support/createPageDocument.js.
 * See also: src/pages/accountPage.js.
 */

import assert from "node:assert/strict";
import "../../../../test/support/installBrowserGlobals.js";
import {
  installFetch,
  installPageDocument,
  queueTest,
  resetLocation,
} from "../../../../test/support/createPageDocument.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

const { createPageRoot } = await installPageDocument();
const { renderAccountPage } = await loadAppModule(new URL("./accountPage.js", import.meta.url).href);

/**
 * Finds an order row by the id stored on it.
 *
 * @param {object} node - Page root to search.
 * @param {string} orderId - Order id stored on the row.
 * @returns {object | null} The matching row.
 */
function findOrderRow(node, orderId) {
  if (node?.dataset?.orderId === orderId) {
    return node;
  }
  for (const child of node.childNodes || []) {
    const match = findOrderRow(child, orderId);
    if (match) {
      return match;
    }
  }
  return null;
}

/**
 * Builds a signed-in shopper.
 *
 * @returns {object} Shell state.
 */
function createShopper() {
  return {
    authToken: "token-01",
    currentUser: { id: "user-01", username: "ada", fullName: "Ada Lovelace", address: { city: "London" } },
  };
}

queueTest("sends a guest to login", async () => {
  resetLocation("/account");
  const pageRoot = createPageRoot();
  await renderAccountPage({ authToken: "", currentUser: null }, pageRoot, []);
  assert.equal(window.location.pathname, "/login");
});

queueTest("returns to the catalog and keeps the page when sign-out fails", async () => {
  installFetch((url) => {
    if (url.includes("sign-out-everywhere")) {
      return { throwError: new Error("sign out failed") };
    }
    if (url.endsWith("/orders") || url.includes("/orders?")) {
      return { body: { items: [] } };
    }
    return { body: { items: [] } };
  });
  resetLocation("/account");
  const pageRoot = createPageRoot();
  await renderAccountPage(createShopper(), pageRoot, []);
  assert.match(pageRoot.textContent, /My Account/);
  pageRoot.querySelector("#continueShoppingButton").click();
  assert.equal(window.location.pathname, "/products");

  const signOutButton = pageRoot.querySelector("#signOutEverywhereButton");
  signOutButton.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(signOutButton.disabled, true);
  assert.match(pageRoot.textContent, /You have not placed any orders yet/);
});

queueTest("explains when orders cannot be loaded", async () => {
  installFetch((url) => {
    if (url.includes("/orders")) {
      return { throwError: new Error("orders down") };
    }
    return { body: {} };
  });
  const pageRoot = createPageRoot();
  await renderAccountPage(createShopper(), pageRoot, []);
  assert.match(pageRoot.textContent, /Unable to load orders/);
});

queueTest("lists orders and opens the one the shopper chooses", async () => {
  installFetch((url) => {
    if (url.includes("/orders")) {
      return {
        body: {
          items: [
            {
              id: "ord-old",
              placedAt: "2026-01-01T00:00:00.000Z",
              items: [{ productId: "mug" }],
              totalAmount: 10,
              status: "shipped",
            },
            {
              id: "ord-new",
              placedAt: "2026-02-01T00:00:00.000Z",
              items: [{ productId: "mug" }, { productId: "cup" }],
              totalAmount: 14,
              status: "placed",
            },
            {
              id: " ",
              placedAt: "",
              items: null,
              totalAmount: 0,
              status: "",
            },
          ],
        },
      };
    }
    return { body: {} };
  });
  resetLocation("/account");
  const pageRoot = createPageRoot();
  const cleanups = [];
  await renderAccountPage(createShopper(), pageRoot, cleanups);
  assert.match(pageRoot.textContent, /3 orders placed/);
  assert.match(pageRoot.textContent, /Export CSV/);
  assert.match(pageRoot.textContent, /Shipped/);
  assert.match(pageRoot.textContent, /\$10\.00/);

  const blankOrder = findOrderRow(pageRoot, " ");
  blankOrder.click();
  assert.equal(window.location.pathname, "/account");

  pageRoot.querySelector("[data-order-id='ord-new']").click();
  assert.equal(window.location.pathname, "/order-details/ord-new");

  installFetch(() => ({ ok: false, body: {} }));
  pageRoot.querySelector("#exportOrdersButton").click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  installFetch(() => ({ ok: true, body: {} }));
  pageRoot.querySelector("#exportOrdersButton").click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.match(pageRoot.textContent, /ord-new/);
  cleanups.forEach((cleanup) => cleanup());
  assert.match(pageRoot.textContent, /My Orders/);
});
