/**
 * Public per-tab post-like and post-created stream client.
 * Role: Lets callers share one posts subscription for the first transport they pass.
 * Not in this file: Toggle writes (src/togglePostLike.js).
 * Key dependencies: src/createPostLikesSession.js.
 * See also: apps/social-media-shell/src/main.js.
 */

import { createPostLikesStream } from "./createPostLikesSession.js";

/** @type {ReturnType<typeof createPostLikesStream> | null} */
let sharedStream = null;

function getOrCreateStream(transport) {
  if (!sharedStream) {
    sharedStream = createPostLikesStream(transport);
  }
  return sharedStream;
}

/**
 * Subscribes to live like counts.
 *
 * @param {{ subscribe: Function }} transport - Event interface.
 * @param {(event: { postId: string, likes: number, ownerId: string, likerId: string, likerName: string, liked: boolean }) => void} listener - Called for every push.
 * @returns {() => void} Unsubscribe function.
 * @sideEffects Subscribes to community-likes/changed.
 */
function subscribeToPostLikesChanged(transport, listener) {
  return getOrCreateStream(transport).subscribe(listener);
}

/**
 * Subscribes to newly created posts.
 *
 * @param {{ subscribe: Function }} transport - Event interface.
 * @param {(post: object) => void} listener - Called with each newly created post.
 * @returns {() => void} Unsubscribe function.
 * @sideEffects Subscribes to community-posts/created.
 */
function subscribeToPostCreated(transport, listener) {
  return getOrCreateStream(transport).subscribeToPostCreated(listener);
}

export { subscribeToPostLikesChanged, subscribeToPostCreated };
