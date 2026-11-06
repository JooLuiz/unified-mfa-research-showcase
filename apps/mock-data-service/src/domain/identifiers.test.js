/**
 * Verifies the shared resource identifier format.
 * Role: Exercises generateIdentifier without persistence.
 * Not in this file: Route handling.
 * Key dependencies: node:test; src/domain/identifiers.js.
 * See also: src/domain/identifiers.js.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { generateIdentifier } = require("./identifiers");

test("generateIdentifier returns a prefixed unique id", () => {
  const firstIdentifier = generateIdentifier("order");
  const secondIdentifier = generateIdentifier("order");

  assert.match(firstIdentifier, /^order-[0-9a-z]+-[0-9a-z]+$/);
  assert.match(secondIdentifier, /^order-[0-9a-z]+-[0-9a-z]+$/);
  assert.notEqual(firstIdentifier, secondIdentifier);
});
