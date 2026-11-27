/**
 * Verifies the community intent publishers and the shell's community intent listeners on an injected transport.
 * Role: Locks the like, author, likes-watching, and post-submitted payloads on every comparison branch.
 * Not in this file: The post-submitted round trip (src/createCommunityEvents.test.js) or window names.
 * Key dependencies: node:test; src/createCommunityEvents.js; test/support/createRecordingTransport.js.
 * See also: src/createCommunityEvents.js; src/communityEventsContracts.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createCommunityEvents } from "./createCommunityEvents.js";
import { createRecordingTransport } from "../../../test/support/createRecordingTransport.js";

/**
 * Waits for promise callbacks queued by the code under test.
 *
 * @returns {Promise<void>}
 */
function flushPromises() {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

test("likes and author selections are published locally, and invalid ones are dropped", () => {
  const transport = createRecordingTransport();
  const communityEvents = createCommunityEvents(transport);
  const author = { username: "ada" };

  communityEvents.publishPostLiked("post-01");
  communityEvents.publishPostLiked(" ");
  communityEvents.publishPostLiked(7);
  communityEvents.publishAuthorSelected(author);
  communityEvents.publishAuthorSelected(null);
  communityEvents.publishAuthorSelected("ada");

  assert.deepEqual(transport.published, [
    { topic: "community", event: "post-liked", payload: { postId: "post-01" }, scope: "local" },
    { topic: "community", event: "author-selected", payload: { author }, scope: "local" },
  ]);
});

test("a likes watch is announced to every client once connected", async () => {
  const transport = createRecordingTransport();
  const communityEvents = createCommunityEvents(transport);

  communityEvents.publishPostLikesWatching("post-01");
  communityEvents.publishPostLikesWatching("");
  await flushPromises();

  assert.deepEqual(transport.published, [
    {
      topic: "community-likes",
      event: "watching",
      payload: { postId: "post-01" },
      scope: "distributed",
    },
  ]);
});

test("a likes watch that never connects publishes nothing and does not throw", async () => {
  const transport = {
    ...createRecordingTransport(),
    whenConnected: () => Promise.reject(new Error("not connected")),
  };
  const published = [];
  transport.publish = (message) => published.push(message);
  const communityEvents = createCommunityEvents(transport);

  communityEvents.publishPostLikesWatching("post-01");
  await flushPromises();

  assert.deepEqual(published, []);
});

test("each community intent handler receives only valid payloads", () => {
  const transport = createRecordingTransport();
  const communityEvents = createCommunityEvents(transport);
  const received = { liked: [], authors: [], posts: [] };
  communityEvents.ensureCommunityIntentListeners({
    onPostLiked: (payload) => received.liked.push(payload),
    onAuthorSelected: (payload) => received.authors.push(payload),
    onPostSubmitted: (payload) => received.posts.push(payload),
  });

  transport.deliver("community", "post-liked", { postId: "post-01" });
  transport.deliver("community", "post-liked", { postId: "" });
  transport.deliver("community", "author-selected", { author: { username: "ada" } });
  transport.deliver("community", "author-selected", { author: "ada" });
  transport.deliver("community", "post-submitted", { content: "Hi", imageUrl: "" });
  transport.deliver("community", "post-submitted", { content: "Hi" });

  assert.deepEqual(received, {
    liked: [{ postId: "post-01" }],
    authors: [{ author: { username: "ada" } }],
    posts: [{ content: "Hi", imageUrl: "" }],
  });
});

test("community intent listeners register once, again after a reset, and only for given handlers", () => {
  const transport = createRecordingTransport();
  const communityEvents = createCommunityEvents(transport);
  const liked = [];
  const handlers = { onPostLiked: (payload) => liked.push(payload.postId) };

  communityEvents.ensureCommunityIntentListeners(handlers);
  communityEvents.ensureCommunityIntentListeners(handlers);
  transport.deliver("community", "author-selected", { author: { username: "ada" } });
  transport.deliver("community", "post-submitted", { content: "Hi", imageUrl: "" });
  transport.deliver("community", "post-liked", { postId: "post-01" });
  assert.deepEqual(liked, ["post-01"]);

  communityEvents.resetCommunityIntentListeners();
  communityEvents.ensureCommunityIntentListeners(handlers);
  transport.deliver("community", "post-liked", { postId: "post-02" });
  // The recording transport keeps the first subscription, so the re-registered one adds a second call.
  assert.deepEqual(liked, ["post-01", "post-02", "post-02"]);
});
