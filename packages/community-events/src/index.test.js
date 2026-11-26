/**
 * Verifies the community event barrel loads the names both branches export.
 * Role: Executes the shared barrel, and locks which post-submitted payloads the shared check accepts.
 * Not in this file: Like and FAQ names that differ by branch.
 * Key dependencies: node:test; src/index.js.
 * See also: src/index.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { COMMUNITY_TOPIC, createCommunityEvents, isValidPostSubmittedRequest } from "./index.js";

test("community events export the shared topic and factory", () => {
  assert.equal(typeof COMMUNITY_TOPIC, "string");
  assert.equal(COMMUNITY_TOPIC.length > 0, true);
  assert.equal(typeof createCommunityEvents, "function");
});

test("a post submission needs string content and imageUrl", () => {
  assert.equal(isValidPostSubmittedRequest({ content: "Hello", imageUrl: "" }), true);
  assert.equal(isValidPostSubmittedRequest(null), false);
  assert.equal(isValidPostSubmittedRequest("Hello"), false);
  assert.equal(isValidPostSubmittedRequest({ content: "Hello" }), false);
  assert.equal(isValidPostSubmittedRequest({ content: 42, imageUrl: "" }), false);
});
