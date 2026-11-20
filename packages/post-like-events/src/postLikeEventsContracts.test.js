/**
 * Verifies the post-like path built from a post id.
 * Role: Locks the toggle path the command and the server share.
 * Not in this file: Sending the toggle.
 * Key dependencies: node:test; src/postLikeEventsContracts.js.
 * See also: src/postLikeEventsContracts.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { buildPostLikeTogglePath } from "./postLikeEventsContracts.js";

test("buildPostLikeTogglePath encodes the post id", () => {
  assert.equal(buildPostLikeTogglePath("post/01"), "/posts/post%2F01/like");
});
