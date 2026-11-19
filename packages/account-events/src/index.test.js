/**
 * Verifies the account event barrel loads the names both branches export.
 * Role: Executes the shared barrel so its export lines are part of the suite.
 * Not in this file: Address-only names that exist on one branch.
 * Key dependencies: node:test; src/index.js.
 * See also: src/index.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  ACCOUNT_PROFILE_SAVE_REQUESTED_EVENT,
  ACCOUNT_TOPIC,
  createAccountEvents,
} from "./index.js";

test("account events export the shared topic, profile event, and factory", () => {
  assert.equal(typeof ACCOUNT_TOPIC, "string");
  assert.equal(ACCOUNT_TOPIC.length > 0, true);
  assert.equal(typeof ACCOUNT_PROFILE_SAVE_REQUESTED_EVENT, "string");
  assert.equal(ACCOUNT_PROFILE_SAVE_REQUESTED_EVENT.length > 0, true);
  assert.equal(typeof createAccountEvents, "function");
});
