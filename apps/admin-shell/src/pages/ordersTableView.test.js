/**
 * Verifies the admin orders table markup for customer, item, total, and status fallbacks.
 * Role: Locks the row text the orders page renders for each order shape.
 * Not in this file: Fetching orders.
 * Key dependencies: node:test; src/pages/ordersTableView.js; test/support/createPageDocument.js.
 * See also: src/pages/ordersTableView.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import "../../../../test/support/installBrowserGlobals.js";
import { installPageDocument } from "../../../../test/support/createPageDocument.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

const { createPageRoot } = await installPageDocument();
const { buildOrderRowMarkup, buildOrdersTableMarkup } = await loadAppModule(
  new URL("./ordersTableView.js", import.meta.url).href,
);

const placedAt = "2026-03-04T12:00:00.000Z";

/**
 * Renders one order row into a page root.
 *
 * @param {object} orderRecord - Order passed to the markup helper.
 * @returns {object} Page root.
 */
function renderRow(orderRecord) {
  const pageRoot = createPageRoot();
  pageRoot.innerHTML = buildOrderRowMarkup(orderRecord);
  return pageRoot;
}

test("uses the customer full name, item quantities, and a currency total", () => {
  const pageRoot = renderRow({
    id: "ord-01",
    customer: { fullName: "Ada Lovelace" },
    placedAt,
    items: [{ quantity: 2 }, { quantity: 1 }, {}],
    totalAmount: 10,
    status: "shipped",
  });
  assert.match(pageRoot.textContent, /Ada Lovelace/);
  assert.match(pageRoot.textContent, /3/);
  assert.match(pageRoot.textContent, /\$10\.00/);
  assert.match(pageRoot.textContent, /Shipped/);
  assert.equal(buildOrdersTableMarkup([]).includes("Customer"), true);
});

test("falls back when the customer, items, total, or status are missing", () => {
  const usernameOnly = renderRow({
    id: "ord-02",
    customer: { username: "ada" },
    placedAt,
    items: [],
    totalAmount: Number.NaN,
    status: "",
  });
  assert.match(usernameOnly.textContent, /ada/);
  assert.match(usernameOnly.textContent, /\$0\.00/);
  assert.match(usernameOnly.textContent, /Placed/);

  const unknownCustomer = renderRow({
    id: "ord-03",
    customer: null,
    placedAt,
    totalAmount: 0,
    status: "custom-state",
  });
  assert.match(unknownCustomer.textContent, /Unknown customer/);
  assert.match(unknownCustomer.textContent, /custom-state/);
});
