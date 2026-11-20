/**
 * Verifies like and new-post delivery on an injected transport.
 * Role: Locks that each subscriber receives one update and nothing after unsubscribe.
 * Not in this file: The live connection or the like toggle command.
 * Key dependencies: node:test; src/createPostLikeEvents.js; test/support/createRecordingTransport.js.
 * See also: src/createPostLikeEvents.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createRecordingTransport } from "../../../test/support/createRecordingTransport.js";
import {
  COMMUNITY_LIKES_CHANGED_EVENT,
  COMMUNITY_LIKES_TOPIC,
  COMMUNITY_POSTS_CREATED_EVENT,
  COMMUNITY_POSTS_TOPIC,
  createPostLikeEvents,
} from "./createPostLikeEvents.js";
import { createPostLikesStream } from "./createPostLikesSession.js";

test("like and new-post subscribers each receive one update until unsubscribe", () => {
  const transport = createRecordingTransport();
  const postLikeEvents = createPostLikeEvents(transport);
  const likeEvents = [];
  const createdPosts = [];
  const unsubscribeLikes = postLikeEvents.subscribeToLikeChanges((likeEvent) => {
    likeEvents.push(likeEvent);
  });
  const unsubscribeCreated = postLikeEvents.subscribeToPostCreated((post) => {
    createdPosts.push(post);
  });
  const likeEvent = {
    postId: "post-01",
    likes: 2,
    ownerId: "u-01",
    likerId: "u-02",
    likerName: "Bruno Silva",
    liked: true,
  };
  const createdPost = { id: "post-09", content: "New" };

  transport.publish({
    topic: COMMUNITY_LIKES_TOPIC,
    event: COMMUNITY_LIKES_CHANGED_EVENT,
    payload: likeEvent,
  });
  transport.publish({
    topic: COMMUNITY_POSTS_TOPIC,
    event: COMMUNITY_POSTS_CREATED_EVENT,
    payload: createdPost,
  });
  unsubscribeLikes();
  unsubscribeCreated();
  transport.publish({
    topic: COMMUNITY_LIKES_TOPIC,
    event: COMMUNITY_LIKES_CHANGED_EVENT,
    payload: { ...likeEvent, likes: 3 },
  });
  transport.publish({
    topic: COMMUNITY_POSTS_TOPIC,
    event: COMMUNITY_POSTS_CREATED_EVENT,
    payload: { id: "post-10" },
  });

  assert.deepEqual(likeEvents, [likeEvent]);
  assert.deepEqual(createdPosts, [createdPost]);
});

test("createPostLikesStream delivers a like and a new post until each listener unsubscribes", () => {
  const transport = createRecordingTransport();
  const postLikesStream = createPostLikesStream(transport);
  const likeEvents = [];
  const createdPosts = [];
  const unsubscribeLikes = postLikesStream.subscribe((likeEvent) => {
    likeEvents.push(likeEvent);
  });
  const unsubscribeCreated = postLikesStream.subscribeToPostCreated((post) => {
    createdPosts.push(post);
  });
  const likeEvent = { postId: "post-01", likes: 2, liked: true };
  const createdPost = { id: "post-09", content: "New" };

  transport.deliver("community-likes", "changed", likeEvent);
  transport.deliver("community-posts", "created", createdPost);
  unsubscribeLikes();
  unsubscribeCreated();
  transport.deliver("community-likes", "changed", { ...likeEvent, likes: 3 });
  transport.deliver("community-posts", "created", { id: "post-10" });

  assert.deepEqual(likeEvents, [likeEvent]);
  assert.deepEqual(createdPosts, [createdPost]);
});
