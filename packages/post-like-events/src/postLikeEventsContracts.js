/**
 * Shared names for the post-like and post-created HTTP and SSE contract.
 * Role: Keeps the toggle command and the live stream on the same paths and event names as the
 *   mock API. `POST_CREATED_EVENT_NAME` travels over the same `/posts/stream` connection as
 *   `POST_LIKES_CHANGED_EVENT_NAME`, matching the server's single social SSE registry
 *   (apps/mock-data-service/src/infrastructure/postLikeEventStream.js).
 * Not in this file: The EventSource lifecycle (src/createPostLikesStream.js) or the toggle
 *   write (src/togglePostLike.js).
 * Key dependencies: None.
 * See also: apps/mock-data-service/src/routes/postLikeRoutes.js;
 *   apps/mock-data-service/src/routes/postRoutes.js.
 */

const POST_LIKES_CHANGED_EVENT_NAME = "community.post-likes-changed";
const POST_CREATED_EVENT_NAME = "community.post-created";
const POST_LIKES_STREAM_PATH = "/posts/stream";

/**
 * Builds the toggle-like path for one post.
 *
 * @param {string} postId - Post to like or unlike.
 * @returns {string} Path under the mock API base url.
 */
function buildPostLikeTogglePath(postId) {
  return `/posts/${encodeURIComponent(postId)}/like`;
}

export {
  POST_LIKES_CHANGED_EVENT_NAME,
  POST_CREATED_EVENT_NAME,
  POST_LIKES_STREAM_PATH,
  buildPostLikeTogglePath,
};
