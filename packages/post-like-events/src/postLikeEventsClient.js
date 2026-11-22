/**
 * Public per-tab post-like and post-created stream client.
 * Role: Lets callers share one posts subscription for the first transport they pass, and announces community-posts/watching once for that transport.
 * Not in this file: Toggle writes (src/togglePostLike.js).
 * Key dependencies: src/createPostLikesSession.js.
 * See also: apps/social-media-shell/src/main.js.
 */

import { createPostLikesStream } from "./createPostLikesSession.js";
import {
  COMMUNITY_POSTS_TOPIC,
  COMMUNITY_POSTS_WATCHING_EVENT,
} from "./postLikeEventsContracts.js";

const MESH_CONNECT_TIMEOUT_MS = 5000;

/**
 * Registers this tab for new-post pushes once, for the first transport that opens the stream.
 *
 * @param {{ publish?: Function, whenConnected?: Function }} transport - Event interface. A subscribe-only fake is ignored.
 * @returns {void}
 * @sideEffects Publishes community-posts/watching. A connect timeout is swallowed.
 */
function publishCommunityPostsWatching(transport) {
  if (!openTransport(transport)) {
    return;
  }
  transport.publish({
    topic: COMMUNITY_POSTS_TOPIC,
    event: COMMUNITY_POSTS_WATCHING_EVENT,
    payload: {},
    scope: "distributed",
  });
}

/**
 * Starts the socket for a transport that can publish. A subscribe-only fake is skipped.
 *
 * @param {{ publish?: Function, whenConnected?: Function }} transport - Event interface.
 * @returns {boolean} True when the caller should publish.
 * @sideEffects Calls whenConnected. A closed client or a connect timeout does not throw.
 */
function openTransport(transport) {
  if (typeof transport.publish !== "function" || typeof transport.whenConnected !== "function") {
    return false;
  }
  try {
    const connected = transport.whenConnected({ timeoutMs: MESH_CONNECT_TIMEOUT_MS });
    if (connected && typeof connected.catch === "function") {
      connected.catch(() => {
        // Open feeds stay on the snapshot they loaded when this announce does not land.
      });
    }
  } catch {
    return false;
  }
  return true;
}

/** @type {ReturnType<typeof createPostLikesStream> | null} */
let sharedStream = null;

function getOrCreateStream(transport) {
  if (!sharedStream) {
    sharedStream = createPostLikesStream(transport);
    publishCommunityPostsWatching(transport);
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
