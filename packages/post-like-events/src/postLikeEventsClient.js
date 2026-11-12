/**
 * Public per-tab post-like and post-created stream client over the Event Mesh gateway.
 * Role: Module-level singleton that lets any page share the tab's single social stream
 *   subscription without each one opening its own connection, plus the pure
 *   applyLikesChangeToPosts helper used by pages to patch a posts array from a changed payload.
 * Not in this file: The underlying mesh subscription/reconnect mechanics
 *   (src/createPostLikesSession.js) or the toggle write (src/togglePostLike.js).
 * Key dependencies: src/createPostLikesSession.js.
 * See also: apps/social-media-shell/src/main.js; apps/social-media-shell/src/pages/feedPage.js;
 *   apps/social-media-shell/src/pages/postsPage.js.
 */

import { createPostLikesStream } from "./createPostLikesSession.js";

const postLikesStream = createPostLikesStream();

/**
 * Starts the tab's shared post-likes and post-created mesh subscriptions. Safe to call for
 *   guests too: like counts and new posts are public.
 *
 * @returns {Promise<void>}
 * @sideEffects Subscribes to community-likes/changed and community-posts/created and publishes
 *   community-posts/watching on an interval.
 */
function startPostLikesLiveEvents() {
  return postLikesStream.start();
}

/**
 * Stops the tab's shared post-likes and post-created mesh subscriptions.
 *
 * @returns {void}
 * @sideEffects Clears the watching interval and removes both mesh subscriptions.
 */
function stopPostLikesLiveEvents() {
  postLikesStream.stop();
}

/**
 * Subscribes to this tab's shared post-likes stream for like-count changes.
 *
 * @param {(event: { postId: string, likes: number, ownerId: string, likerId: string, likerName: string, liked: boolean }) => void} listener - Called for every push.
 * @returns {() => void} Unsubscribe function; call it on page unmount.
 */
function subscribeToPostLikesChanged(listener) {
  return postLikesStream.subscribe(listener);
}

/**
 * Subscribes to this tab's shared social stream for newly created posts.
 *
 * @param {(post: object) => void} listener - Called with each newly created post.
 * @returns {() => void} Unsubscribe function; call it on page unmount.
 */
function subscribeToPostCreated(listener) {
  return postLikesStream.subscribeToPostCreated(listener);
}

/**
 * Applies one community-likes/changed payload to a posts array.
 *
 * The public `likes` count is patched for every viewer. `likedByCurrentUser` is patched only
 * when this viewer is the payload's `likerId` — everyone else's own like/unlike state of that
 * post hasn't changed, and the broadcast has no way to carry a per-viewer flag for every other
 * watcher at once.
 *
 * @param {object[]} posts - Posts array to patch (not mutated).
 * @param {string | null | undefined} viewerUserId - Current viewer's id, or null/undefined for a guest.
 * @param {{ postId: string, likes: number, likerId: string, liked: boolean }} payload - community-likes/changed payload.
 * @returns {object[]} New posts array with the matching post patched.
 */
function applyLikesChangeToPosts(posts, viewerUserId, payload) {
  return posts.map((post) =>
    post.id === payload.postId
      ? {
          ...post,
          likes: payload.likes,
          ...(viewerUserId && payload.likerId === viewerUserId
            ? { likedByCurrentUser: payload.liked }
            : {}),
        }
      : post,
  );
}

export {
  startPostLikesLiveEvents,
  stopPostLikesLiveEvents,
  subscribeToPostLikesChanged,
  subscribeToPostCreated,
  applyLikesChangeToPosts,
};
