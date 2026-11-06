/**
 * Verifies the post stream delivers like changes and new posts until unsubscribe.
 * Role: Locks the SSE event names and listener fan-out of createPostLikesStream.
 * Not in this file: The like toggle HTTP command.
 * Key dependencies: node:test; src/createPostLikesStream.js; test/support/installBrowserTestDoubles.js.
 * See also: src/createPostLikesStream.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createPostLikesStream } from "./createPostLikesStream.js";
import {
  FakeEventSource,
  installBrowserTestDoubles,
} from "../../../test/support/installBrowserTestDoubles.js";

test("subscribe and subscribeToPostCreated deliver until unsubscribe", () => {
  installBrowserTestDoubles();
  const stream = createPostLikesStream({ apiBaseUrl: "http://localhost:4000/api" });
  const likeEvents = [];
  const createdPosts = [];
  const unsubscribeLikes = stream.subscribe((likeEvent) => {
    likeEvents.push(likeEvent);
  });
  const unsubscribeCreated = stream.subscribeToPostCreated((post) => {
    createdPosts.push(post);
  });
  const eventSource = FakeEventSource.latestMatching("/posts/stream");
  const likeEvent = {
    postId: "post-01",
    likes: 2,
    ownerId: "u-01",
    likerId: "u-02",
    likerName: "Bruno Silva",
    liked: true,
  };
  const createdPost = { id: "post-09", content: "New" };

  eventSource.emit("community.post-likes-changed", likeEvent);
  eventSource.emit("community.post-created", createdPost);
  unsubscribeLikes();
  unsubscribeCreated();
  eventSource.emit("community.post-likes-changed", { ...likeEvent, likes: 3 });
  eventSource.emit("community.post-created", { id: "post-10" });

  assert.deepEqual(likeEvents, [likeEvent]);
  assert.deepEqual(createdPosts, [createdPost]);
});
