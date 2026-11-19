/**
 * Verifies order detail formatting for missing and present values.
 * Role: Locks the currency, date, and address text the order details view shows.
 * Not in this file: Loading an order.
 * Key dependencies: node:test; src/order-details-utils.js.
 * See also: src/order-details-utils.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { buildAddressLines, formatCurrencyValue, formatDateValue } from "./order-details-utils.js";

test("missing amounts, dates, and addresses format as empty values", () => {
  assert.equal(formatCurrencyValue("nope"), "$0.00");
  assert.equal(formatCurrencyValue(12), "$12.00");
  assert.equal(formatDateValue(""), "-");
  assert.equal(formatDateValue("not-a-date"), "not-a-date");
  assert.notEqual(formatDateValue("2026-01-02T15:04:00.000Z"), "-");
  assert.deepEqual(buildAddressLines(null), []);
  assert.deepEqual(
    buildAddressLines({
      street: "1 Main",
      city: "Austin",
      state: "TX",
      postalCode: "78701",
      country: "US",
    }),
    ["1 Main", "Austin, TX", "78701 - US"],
  );
  assert.deepEqual(buildAddressLines({ city: "Austin" }), ["Austin"]);
});
