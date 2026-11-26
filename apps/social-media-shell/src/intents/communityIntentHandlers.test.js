/**
 * Verifies a member's like and new-post requests change the feed and confirm the same way.
 * Role: Locks each community request outcome on every comparison branch.
 * Not in this file: How a request reaches the shell. Replies come from a recording transport.
 * Key dependencies: node:test; src/intents/communityIntentHandlers.js;
 *   test/support/createRecordingTransport.js; test/support/loadAppModule.js.
 * See also: src/intents/communityIntentHandlers.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createRecordingTransport } from "../../../../test/support/createRecordingTransport.js";
import "../../../../test/support/installBrowserGlobals.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

const { createCommunityIntentHandlers } = await loadAppModule(
  new URL("./communityIntentHandlers.js", import.meta.url).href,
);

/**
 * Builds a signed-in member's state, a scripted transport, and handlers with recorded effects.
 *
 * @param {object} script - Request outcomes for createRecordingTransport.
 * @param {{ authToken?: string }} [session] - Session override.
 * @returns {{ appState: object, handlers: object, notices: object[], renders: number[] }}
 */
function createMemberHandlers(script, { authToken = "token-01" } = {}) {
  const appState = {
    authToken,
    currentUser: authToken ? { id: "user-01" } : null,
    posts: [{ id: "post-01", likes: 0, likedByCurrentUser: false }],
  };
  const notices = [];
  const renders = [];
  const handlers = createCommunityIntentHandlers(createRecordingTransport(script), appState, {
    notify: (notice) => notices.push(notice),
    requestRender: () => renders.push(1),
  });
  return { appState, handlers, notices, renders };
}

test("a like the server accepts updates the post's count", async () => {
  const { appState, handlers } = createMemberHandlers({
    requestReply: { ok: true, liked: true, likes: 1 },
  });
  const result = await handlers.onPostLiked({ postId: "post-01" });
  assert.deepEqual(result, { liked: true, likes: 1 });
  assert.equal(appState.posts[0].likes, 1);
  assert.equal(appState.posts[0].likedByCurrentUser, true);
});

test("a like on a post that is not loaded changes nothing", async () => {
  const { appState, handlers } = createMemberHandlers({});
  appState.posts = undefined;
  assert.equal(await handlers.onPostLiked({ postId: "missing" }), null);
});

test("selecting an author keeps the member on the page", () => {
  const { handlers, notices, renders } = createMemberHandlers({});
  assert.equal(handlers.onAuthorSelected({ author: { username: "ada" } }), undefined);
  assert.deepEqual(notices, []);
  assert.deepEqual(renders, []);
});

test("a published post is kept, confirmed, and re-rendered", async () => {
  const { appState, handlers, notices, renders } = createMemberHandlers({
    requestReply: { ok: true, post: { id: "post-02", content: "Hello" } },
  });
  const result = await handlers.onPostSubmitted({ content: "Hello", imageUrl: "" });
  assert.equal(result.ok, true);
  assert.equal(appState.posts[0].id, "post-02");
  assert.deepEqual(notices, [
    {
      type: "success",
      title: "Post published",
      message: "Your post is now visible in the community feed.",
    },
  ]);
  assert.equal(renders.length, 1);
});

test("a failed publish keeps the feed and stays quiet", async () => {
  const { appState, handlers, notices, renders } = createMemberHandlers({
    requestReply: { ok: false, code: "network-error" },
  });
  const result = await handlers.onPostSubmitted({ content: "Hello", imageUrl: "" });
  assert.deepEqual(result, { ok: false });
  assert.equal(appState.posts.length, 1);
  assert.deepEqual(notices, []);
  assert.deepEqual(renders, []);
});

test("a signed-out member cannot publish", async () => {
  const { appState, handlers, renders } = createMemberHandlers({}, { authToken: "" });
  assert.equal(await handlers.onPostSubmitted({ content: "Hello", imageUrl: "" }), undefined);
  assert.equal(appState.posts.length, 1);
  assert.deepEqual(renders, []);
});
