/**
 * Verifies the checkout event barrel loads the names both branches export.
 * Role: Executes the shared barrel so its export lines are part of the suite.
 * Not in this file: Coupon helper names that differ by branch.
 * Key dependencies: node:test; src/index.js.
 * See also: src/index.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { CHECKOUT_TOPIC, createCheckoutEvents } from "./index.js";

test("checkout events export the shared topic and factory", () => {
  assert.equal(typeof CHECKOUT_TOPIC, "string");
  assert.equal(CHECKOUT_TOPIC.length > 0, true);
  assert.equal(typeof createCheckoutEvents, "function");
});
