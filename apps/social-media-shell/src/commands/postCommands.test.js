/**
 * Verifies a new post is kept, and a signed-out, malformed, or failed publish leaves the feed unchanged.
 * Role: Locks the outcomes of persistNewPost.
 * Not in this file: The new-post form.
 * Key dependencies: node:test; src/commands/postCommands.js; test/support/loadAppModule.js;
 *   test/support/createRecordingTransport.js.
 * See also: src/commands/postCommands.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import "../../../../test/support/installBrowserGlobals.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";
import { createRecordingTransport } from "../../../../test/support/createRecordingTransport.js";

const { persistNewPost } = await loadAppModule(new URL("./postCommands.js", import.meta.url).href);

test("a signed-out publish leaves the feed unchanged, and a saved post is kept once", async () => {
  const createdPost = { id: "post-02", content: "New" };
  const transport = createRecordingTransport({
    requestReplies: [
      { ok: true, post: createdPost },
      { ok: true, post: createdPost },
      { ok: false, code: "network-error" },
    ],
  });
  const appState = { authToken: "", posts: [{ id: "post-01", content: "Existing" }] };

  const signedOut = await persistNewPost(transport, appState, { content: "New", imageUrl: "" });
  assert.deepEqual(signedOut, { ok: false });
  assert.equal(appState.posts.length, 1);
  assert.equal(transport.published.length, 0);

  appState.authToken = "token-01";
  const saved = await persistNewPost(transport, appState, { content: "New", imageUrl: "" });
  assert.equal(saved.ok, true);
  assert.equal(appState.posts[0].id, "post-02");
  assert.deepEqual(transport.published[0], {
    topic: "community-posts",
    event: "create",
    payload: { authToken: "token-01", post: { content: "New", imageUrl: "" } },
  });

  const duplicate = await persistNewPost(transport, appState, { content: "New", imageUrl: "" });
  assert.equal(duplicate.ok, true);
  assert.equal(appState.posts.filter((post) => post.id === "post-02").length, 1);

  const failed = await persistNewPost(transport, appState, { content: "Later", imageUrl: "" });
  assert.deepEqual(failed, { ok: false });
  assert.equal(appState.posts.length, 2);
});

test("a malformed post is not sent and leaves the feed unchanged", async () => {
  const transport = createRecordingTransport();
  const appState = { authToken: "token-01", posts: [{ id: "post-01", content: "Existing" }] };

  const missingImage = await persistNewPost(transport, appState, { content: "New" });
  const missingPost = await persistNewPost(transport, appState, null);

  assert.deepEqual(missingImage, { ok: false });
  assert.deepEqual(missingPost, { ok: false });
  assert.equal(appState.posts.length, 1);
  assert.equal(transport.published.length, 0);
});
