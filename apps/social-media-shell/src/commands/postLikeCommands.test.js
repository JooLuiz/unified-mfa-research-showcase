/**
 * Verifies the post like count after a toggle is accepted, rejected, or not sent.
 * Role: Locks the missing-post, signed-out, accepted, and rejected outcomes of toggleLikeForPost.
 * Not in this file: Live counts from other viewers (src/pages/feedPage.js).
 * Key dependencies: node:test; src/commands/postLikeCommands.js; test/support/loadAppModule.js;
 *   test/support/createRecordingTransport.js.
 * See also: src/commands/postLikeCommands.js; packages/post-like-events/src/togglePostLike.test.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import "../../../../test/support/installBrowserGlobals.js";
import { createRecordingTransport } from "../../../../test/support/createRecordingTransport.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

const { toggleLikeForPost } = await loadAppModule(
  new URL("./postLikeCommands.js", import.meta.url).href,
);

/**
 * Builds shell state with one post that has two likes.
 *
 * @param {string} authToken - Session token, or an empty string for a guest.
 * @returns {object} Shell state for the social shell.
 */
function createLikeState(authToken) {
  return {
    authToken,
    posts: [{ id: "post-01", likes: 2, likedByCurrentUser: false }],
  };
}

test("a like without a session or a post leaves the post count unchanged", async () => {
  const originalWarn = console.warn;
  console.warn = () => {};
  const appState = createLikeState("");
  const transport = createRecordingTransport();

  try {
    const signedOut = await toggleLikeForPost(transport, appState, appState.posts[0]);
    assert.equal(signedOut ?? null, null);
    assert.equal(appState.posts[0].likes, 2);

    const missingPost = await toggleLikeForPost(transport, appState, null);
    assert.equal(missingPost ?? null, null);
    assert.equal(appState.posts[0].likes, 2);
    assert.equal(transport.published.length, 0);
  } finally {
    console.warn = originalWarn;
  }
});

test("an accepted like updates the post count and the viewer's like", async () => {
  const appState = createLikeState("token-01");
  const transport = createRecordingTransport({
    requestReply: { ok: true, liked: true, likes: 3 },
  });

  const toggleResult = await toggleLikeForPost(transport, appState, appState.posts[0]);

  assert.deepEqual(toggleResult, { liked: true, likes: 3 });
  assert.equal(appState.posts[0].likes, 3);
  assert.equal(appState.posts[0].likedByCurrentUser, true);
});

test("a rejected like leaves the post count unchanged", async () => {
  const appState = createLikeState("token-01");
  const transport = createRecordingTransport({
    requestReply: { ok: false, code: "author-cannot-like" },
  });

  const toggleResult = await toggleLikeForPost(transport, appState, appState.posts[0]);

  assert.equal(toggleResult, null);
  assert.equal(appState.posts[0].likes, 2);
  assert.equal(appState.posts[0].likedByCurrentUser, false);
});
