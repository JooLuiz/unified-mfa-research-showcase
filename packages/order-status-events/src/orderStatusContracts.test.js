/**
 * Verifies the order-status label for a stored status.
 * Role: Locks the placed default, a known label, and an unknown status returned as itself.
 * Not in this file: The EventSource lifecycle or the status write.
 * Key dependencies: node:test; src/orderStatusContracts.js.
 * See also: src/orderStatusContracts.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { formatOrderStatus } from "./orderStatusContracts.js";

test("formatOrderStatus labels a known status and treats a missing status as placed", () => {
  assert.equal(formatOrderStatus(undefined), "Placed");
  assert.equal(formatOrderStatus(""), "Placed");
  assert.equal(formatOrderStatus("   "), "Placed");
  assert.equal(formatOrderStatus(12), "Placed");
  assert.equal(formatOrderStatus("shipped"), "Shipped");
  assert.equal(formatOrderStatus("held"), "held");
});
