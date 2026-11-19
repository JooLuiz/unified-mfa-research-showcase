/**
 * Verifies the shared post-like rejection a caller can observe without a token.
 * Role: Locks that a missing bearer token surfaces as unauthorized.
 * Not in this file: A successful toggle or the live like connection. Those need the branch transport.
 * Key dependencies: node:test; src/togglePostLike.js.
 * See also: src/togglePostLike.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { togglePostLike } from "./togglePostLike.js";

test("togglePostLike without a token is unauthorized", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false,
    json: async () => ({ code: "unauthorized" }),
  });

  try {
    const result = await togglePostLike({
      apiBaseUrl: "http://localhost:4000/api",
      authToken: "",
      postId: "post-01",
    });
    assert.deepEqual(result, { ok: false, code: "unauthorized" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
