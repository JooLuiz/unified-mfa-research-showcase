/**
 * Toggles likes for the social media shell.
 * Role: Owns the like/unlike HTTP command, keeps appState.posts in sync with the result, and
 *   fires the liker's own "Post Liked" toast. The named owner toast is a separate concern
 *   (see src/main.js's global subscribeToPostLikesChanged listener), since the owner is not
 *   the one making this request.
 * Not in this file: Live reconciliation from other viewers' toggles (src/main.js,
 *   src/pages/feedPage.js, src/pages/postsPage.js, src/pages/accountPage.js) or post creation
 *   (src/commands/postCommands.js).
 * Key dependencies: @shared/post-like-events; src/notifications/notificationAdapter.js.
 * See also: src/pages/feedPage.js; src/pages/postsPage.js; src/pages/accountPage.js.
 */

import { togglePostLike } from "@shared/post-like-events";
import { MOCK_API_BASE_URL } from "../utils/constants";
import { publishNotification } from "../notifications/notificationAdapter";

/**
 * Replaces one post's `likes`/`likedByCurrentUser` inside appState.posts.
 *
 * @param {object} appState - Shell state holding the live posts array.
 * @param {string} postId - Post to patch.
 * @param {{ likes: number, likedByCurrentUser: boolean }} patch - Fields to apply.
 * @returns {void}
 * @sideEffects Replaces appState.posts with a new array containing the patched post.
 */
function patchPostInAppState(appState, postId, patch) {
  appState.posts = appState.posts.map((post) =>
    post.id === postId ? { ...post, ...patch } : post,
  );
}

/**
 * Toggles the signed-in viewer's like on one post. A guest or the post's own author is
 * rejected by the server; this command surfaces that as a quiet no-op rather than a toast,
 * since the UI already disables the button for both cases.
 *
 * @param {object} appState - Shell state holding the authenticated session and live posts.
 * @param {object} post - Post to like or unlike.
 * @returns {Promise<{ liked: boolean, likes: number } | null>} The new toggle state, or null when the request did not succeed.
 * @sideEffects Performs the HTTP toggle write, patches appState.posts on success, and fires the "Post Liked" toast when the result is a like.
 */
async function toggleLikeForPost(appState, post) {
  if (!post || !appState.authToken) {
    publishNotification({
      type: "error",
      title: "Sign in to like posts",
      message: "Please sign in and try again.",
    });
    return null;
  }

  const toggleResult = await togglePostLike({
    apiBaseUrl: MOCK_API_BASE_URL,
    authToken: appState.authToken,
    postId: post.id,
  });
  if (!toggleResult.ok) {
    return null;
  }

  patchPostInAppState(appState, post.id, {
    likes: toggleResult.likes,
    likedByCurrentUser: toggleResult.liked,
  });

  if (toggleResult.liked) {
    publishNotification({
      type: "success",
      title: "Post Liked",
      message: "You liked this post.",
    });
  }

  return { liked: toggleResult.liked, likes: toggleResult.likes };
}

export { toggleLikeForPost };
