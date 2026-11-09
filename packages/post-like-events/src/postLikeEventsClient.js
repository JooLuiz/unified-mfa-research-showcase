/**
 * Public per-tab post-like and post-created stream client.
 * Role: Module-level singleton (one per apiBaseUrl) that lets any page share the tab's single
 *   social stream without each one opening its own connection.
 * Not in this file: The underlying EventSource/reconnect mechanics (src/createPostLikesStream.js)
 *   or the toggle write (src/togglePostLike.js).
 * Key dependencies: src/createPostLikesStream.js.
 * See also: apps/social-media-shell/src/main.js; apps/social-media-shell/src/pages/feedPage.js;
 *   apps/social-media-shell/src/pages/postsPage.js.
 */

import { createPostLikesStream } from "./createPostLikesStream.js";

/** @type {Map<string, ReturnType<typeof createPostLikesStream>>} */
const streamsByApiBaseUrl = new Map();

function getOrCreateStream(apiBaseUrl) {
  const existingStream = streamsByApiBaseUrl.get(apiBaseUrl);
  if (existingStream) {
    return existingStream;
  }
  const stream = createPostLikesStream({ apiBaseUrl });
  streamsByApiBaseUrl.set(apiBaseUrl, stream);
  return stream;
}

/**
 * Subscribes to this tab's shared post-likes stream for one API base url, opening it (if not
 * already opened by an earlier caller) on first use. The stream stays open for the life of the
 * tab, independent of any one subscriber's lifetime.
 *
 * @param {string} apiBaseUrl - Mock API base URL.
 * @param {(event: { postId: string, likes: number, ownerId: string, likerId: string, likerName: string, liked: boolean }) => void} listener - Called for every push.
 * @returns {() => void} Unsubscribe function; call it on page unmount.
 */
function subscribeToPostLikesChanged(apiBaseUrl, listener) {
  return getOrCreateStream(apiBaseUrl).subscribe(listener);
}

/**
 * Subscribes to this tab's shared social stream for newly created posts, opening it (if not
 * already opened by an earlier caller, likes or otherwise) on first use.
 *
 * @param {string} apiBaseUrl - Mock API base URL.
 * @param {(post: object) => void} listener - Called with each newly created post.
 * @returns {() => void} Unsubscribe function; call it on page unmount.
 */
function subscribeToPostCreated(apiBaseUrl, listener) {
  return getOrCreateStream(apiBaseUrl).subscribeToPostCreated(listener);
}

export { subscribeToPostLikesChanged, subscribeToPostCreated };
