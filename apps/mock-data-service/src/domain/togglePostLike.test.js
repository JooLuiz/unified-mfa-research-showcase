/**
 * Verifies the post-like toggle use case.
 * Role: Calls togglePostLike with an in-memory store and recording broadcasters, and checks the
 *   returned outcome, the stored likes, and the broadcasts.
 * Not in this file: Like count rules (src/domain/postLikes.test.js) or how a caller receives
 *   the outcome.
 * Key dependencies: node:test; src/domain/togglePostLike.js; test/invokeRouter.js; test/recordCalls.js.
 * See also: src/domain/postLikes.test.js.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const { togglePostLike } = require("./togglePostLike");
const { LIKE_NOT_ALLOWED_CODE } = require("./postLikes");
const { POST_NOT_FOUND_CODE, USER_NOT_FOUND_CODE } = require("./useCaseCodes");
const { createMemoryJsonStore } = require("../../test/invokeRouter");
const { recordCalls } = require("../../test/recordCalls");

const author = { id: "u-author", username: "writer", fullName: "Writer" };
const reader = { id: "u-reader", username: "reader" };
const post = { id: "post-1", authorId: "u-author", title: "Hello" };

function createStreams({ withInbox = true } = {}) {
  return {
    postLikes: recordCalls(["broadcastLikesChanged"]),
    ...(withInbox ? { notificationInbox: recordCalls(["broadcastNotificationChanged"]) } : {}),
  };
}

function createStore(postLikes = []) {
  return createMemoryJsonStore({
    "users.json": [author, reader],
    "posts.json": [post],
    "postLikes.json": postLikes,
  });
}

test("togglePostLike rejects an unknown user", async () => {
  const store = createStore();
  const streams = createStreams();

  const outcome = await togglePostLike({ jsonStore: store, userId: "missing", payload: { postId: "post-1" }, streams });

  assert.deepEqual(outcome, { ok: false, code: USER_NOT_FOUND_CODE });
  assert.deepEqual(streams.postLikes.calls, []);
});

test("togglePostLike rejects a missing post", async () => {
  const store = createStore();
  const streams = createStreams();

  const outcome = await togglePostLike({ jsonStore: store, userId: "u-reader", payload: null, streams });

  assert.deepEqual(outcome, { ok: false, code: POST_NOT_FOUND_CODE });
  assert.deepEqual(store.files["postLikes.json"], []);
});

test("togglePostLike rejects the author liking their own post", async () => {
  const store = createStore();
  const streams = createStreams();

  const outcome = await togglePostLike({ jsonStore: store, userId: "u-author", payload: { postId: "post-1" }, streams });

  assert.deepEqual(outcome, { ok: false, code: LIKE_NOT_ALLOWED_CODE });
  assert.deepEqual(store.files["postLikes.json"], []);
  assert.deepEqual(streams.postLikes.calls, []);
});

test("togglePostLike likes a post, broadcasts the count, and notifies the author", async () => {
  const store = createStore();
  const streams = createStreams();

  const outcome = await togglePostLike({ jsonStore: store, userId: "u-reader", payload: { postId: "post-1" }, streams });

  assert.deepEqual(outcome, { ok: true, result: { liked: true, likes: 1 } });
  assert.deepEqual(store.files["postLikes.json"], [{ postId: "post-1", userId: "u-reader" }]);
  assert.deepEqual(streams.postLikes.calls, [[
    "broadcastLikesChanged",
    "post-1",
    { postId: "post-1", likes: 1, ownerId: "u-author", likerId: "u-reader", likerName: "reader", liked: true },
  ]]);
  const [authorRow] = store.files["notificationInbox.json"];
  assert.equal(authorRow.userId, "u-author");
  assert.match(authorRow.message, /^reader liked your post/);
  assert.equal(streams.notificationInbox.calls.length, 1);
});

test("togglePostLike unlikes a post without notifying the author", async () => {
  const store = createStore([{ postId: "post-1", userId: "u-reader" }]);
  const streams = createStreams();

  const outcome = await togglePostLike({ jsonStore: store, userId: "u-reader", payload: { postId: "post-1" }, streams });

  assert.deepEqual(outcome, { ok: true, result: { liked: false, likes: 0 } });
  assert.deepEqual(store.files["postLikes.json"], []);
  assert.equal(streams.postLikes.calls.length, 1);
  assert.equal(store.files["notificationInbox.json"], undefined);
});

test("togglePostLike skips the author notification when no inbox broadcaster is given", async () => {
  const store = createStore();
  const streams = createStreams({ withInbox: false });

  const outcome = await togglePostLike({ jsonStore: store, userId: "u-reader", payload: { postId: "post-1" }, streams });

  assert.equal(outcome.ok, true);
  assert.equal(store.files["notificationInbox.json"], undefined);
});
