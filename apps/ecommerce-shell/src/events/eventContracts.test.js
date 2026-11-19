/**
 * Verifies the ecommerce cart and catalog names both branches export.
 * Role: Locks the contract names shared by the two eventContracts modules.
 * Not in this file: Shell-only auth names that differ by branch.
 * Key dependencies: node:test; src/events/eventContracts.js.
 * See also: src/events/eventContracts.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  CART_CHANGED_EVENT,
  CART_ITEM_ADD_REQUESTED_EVENT,
  CART_TOPIC,
  CATALOG_TOPIC,
} from "./eventContracts.js";

test("ecommerce event contracts expose the shared cart and catalog names", () => {
  const contractNames = [
    CART_TOPIC,
    CART_CHANGED_EVENT,
    CART_ITEM_ADD_REQUESTED_EVENT,
    CATALOG_TOPIC,
  ];
  for (const contractName of contractNames) {
    assert.equal(typeof contractName, "string");
    assert.equal(contractName.length > 0, true);
  }
});
