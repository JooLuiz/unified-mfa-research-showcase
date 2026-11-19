/**
 * Verifies a like without a post or a session leaves the post count unchanged.
 * Role: Locks the missing-post and signed-out outcomes of toggleLikeForPost.
 * Not in this file: A like the server rejects. That request uses the branch transport.
 * Key dependencies: node:test; src/commands/postLikeCommands.js; test/support/loadAppModule.js.
 * See also: src/commands/postLikeCommands.js; packages/post-like-events/src/togglePostLike.test.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import "../../../../test/support/installBrowserGlobals.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

const { toggleLikeForPost } = await loadAppModule(
  new URL("./postLikeCommands.js", import.meta.url).href,
);

test("a like without a session or a post leaves the post count unchanged", async () => {
  const originalWarn = console.warn;
  console.warn = () => {};
  const appState = {
    authToken: "",
    posts: [{ id: "post-01", likes: 2, likedByCurrentUser: false }],
  };

  try {
    const signedOut = await toggleLikeForPost(appState, appState.posts[0]);
    assert.equal(signedOut ?? null, null);
    assert.equal(appState.posts[0].likes, 2);

    const missingPost = await toggleLikeForPost(appState, null);
    assert.equal(missingPost ?? null, null);
    assert.equal(appState.posts[0].likes, 2);
  } finally {
    console.warn = originalWarn;
  }
});
