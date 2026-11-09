/**
 * Sends one post-like toggle to the mock API.
 * Role: POST /posts/:postId/like for the signed-in caller's own like/unlike.
 * Not in this file: The SSE connection (src/createPostLikesStream.js).
 * Key dependencies: fetch; src/postLikeEventsContracts.js.
 * See also: apps/mock-data-service/src/routes/postLikeRoutes.js.
 */

import { buildPostLikeTogglePath } from "./postLikeEventsContracts.js";

/**
 * Asks the server to toggle the caller's like on one post.
 *
 * @param {{ apiBaseUrl: string, authToken: string, postId: string }} toggleInput - API base, bearer token, and the post to like/unlike.
 * @returns {Promise<{ ok: true, liked: boolean, likes: number } | { ok: false, code: string }>} The resulting toggle state, or a rejection code.
 * @sideEffects Performs the HTTP toggle write.
 */
async function togglePostLike({ apiBaseUrl, authToken, postId }) {
  try {
    const response = await fetch(`${apiBaseUrl}${buildPostLikeTogglePath(postId)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      return { ok: false, code: errorBody.code || "request-failed" };
    }
    const toggleResult = await response.json();
    return { ok: true, liked: toggleResult.liked, likes: toggleResult.likes };
  } catch (error) {
    console.warn("togglePostLike - error");
    console.warn(error);
    return { ok: false, code: "network-error" };
  }
}

export { togglePostLike };
