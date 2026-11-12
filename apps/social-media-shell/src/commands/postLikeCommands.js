/**
 * Toggles likes for the social media shell over the Event Mesh gateway.
 * Role: Calls the shared toggle command and fires the liker's own "Post Liked" toast on an
 *   accepted like. A guest or the post's own author is rejected by the server; this command
 *   surfaces that as a quiet no-op rather than a toast, since the UI already disables the
 *   button for both cases.
 * Not in this file: appState.posts is NOT patched here on purpose — the gateway also
 *   broadcasts community-likes/changed to every client watching that post, including this one
 *   (each mounted post card already announced watching via
 *   @shared/community-events' publishPostLikesWatching), so src/main.js's global
 *   subscribeToPostLikesChanged listener applies that patch once for every viewer rather
 *   than this command patching it twice. The author's persisted toast comes from the inbox
 *   stream, since the owner is not the one making this request.
 * Key dependencies: @shared/post-like-events; src/notifications/notificationAdapter.js.
 * See also: src/main.js; apps/mock-data-service/src/event-mesh/postLikeHandler.js.
 */

import { togglePostLike } from "@shared/post-like-events";
import { publishNotification } from "../notifications/notificationAdapter";

/**
 * Toggles the signed-in viewer's like on one post. A guest or the post's own author is
 * rejected by the server; this command surfaces that as a quiet no-op rather than a toast,
 * since the UI already disables the button for both cases.
 *
 * @param {object} appState - Shell state holding the authenticated session.
 * @param {string} postId - Community post identifier from the community/post-liked intent.
 * @returns {Promise<void>}
 * @sideEffects Publishes community-likes/toggle through the shared command and waits for the
 *   targeted reply; fires the "Post Liked" toast when the result is a like.
 */
async function toggleLikeForPost(appState, postId) {
  if (typeof postId !== "string" || postId.trim() === "" || !appState.authToken) {
    publishNotification({
      type: "error",
      title: "Sign in to like posts",
      message: "Please sign in and try again.",
    });
    return;
  }

  const toggleOutcome = await togglePostLike({
    authToken: appState.authToken,
    postId,
  });

  if (toggleOutcome.ok && toggleOutcome.liked) {
    publishNotification({
      type: "success",
      title: "Post Liked",
      message: "You liked this post.",
    });
  }
}

export { toggleLikeForPost };
