/**
 * Verifies the shared post-like rejection a caller can observe.
 * Role: Locks that an unauthorized transport outcome is returned with the toggle request.
 * Not in this file: The live like connection.
 * Key dependencies: node:test; src/togglePostLike.js; test/support/createRecordingTransport.js.
 * See also: src/togglePostLike.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createRecordingTransport } from "../../../test/support/createRecordingTransport.js";
import { togglePostLike } from "./togglePostLike.js";

test("togglePostLike returns the transport's unauthorized outcome", async () => {
  const transport = createRecordingTransport({
    requestReply: { ok: false, code: "unauthorized" },
  });

  const result = await togglePostLike(transport, { postId: "post-01" });

  assert.deepEqual(result, { ok: false, code: "unauthorized" });
  assert.deepEqual(transport.published, [
    {
      topic: "community-likes",
      event: "toggle",
      payload: { postId: "post-01" },
    },
  ]);
});

test("togglePostLike returns an accepted like and a scripted network failure", async () => {
  const acceptedTransport = createRecordingTransport({
    requestReply: { ok: true, liked: true, likes: 5 },
  });
  const accepted = await togglePostLike(acceptedTransport, { postId: "post-01" });
  assert.deepEqual(accepted, { ok: true, liked: true, likes: 5 });

  const failedTransport = createRecordingTransport({
    requestReply: { ok: false, code: "network-error" },
  });
  const failed = await togglePostLike(failedTransport, { postId: "post-01" });
  assert.deepEqual(failed, { ok: false, code: "network-error" });
});
