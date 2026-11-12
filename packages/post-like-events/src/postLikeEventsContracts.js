/**
 * Shared names for the post-like and post-created Event Mesh contract.
 * Role: Keeps the toggle command and the live stream on the same topic and event names as the
 *   mock API gateway. `COMMUNITY_POSTS_CREATED_EVENT` travels over the same mesh subscription
 *   as `COMMUNITY_LIKES_CHANGED_EVENT`, matching the server's single social registry
 *   (apps/mock-data-service/src/infrastructure/postLikeEvents.js).
 * Not in this file: The mesh subscription lifecycle (src/createPostLikesSession.js) or the toggle
 *   write (src/togglePostLike.js).
 * Key dependencies: None.
 * See also: apps/mock-data-service/src/inbound/postLikeHandler.js;
 *   apps/mock-data-service/src/routes/postRoutes.js.
 */

const COMMUNITY_LIKES_TOPIC = "community-likes";
const COMMUNITY_LIKES_CHANGED_EVENT = "changed";
const COMMUNITY_LIKES_TOGGLE_EVENT = "toggle";
const COMMUNITY_LIKES_ACCEPTED_EVENT = "accepted";
const COMMUNITY_LIKES_REJECTED_EVENT = "rejected";
const COMMUNITY_POSTS_TOPIC = "community-posts";
const COMMUNITY_POSTS_WATCHING_EVENT = "watching";
const COMMUNITY_POSTS_CREATED_EVENT = "created";
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
  COMMUNITY_LIKES_ACCEPTED_EVENT,
  COMMUNITY_LIKES_CHANGED_EVENT,
  COMMUNITY_LIKES_REJECTED_EVENT,
  COMMUNITY_LIKES_TOPIC,
  COMMUNITY_LIKES_TOGGLE_EVENT,
  COMMUNITY_POSTS_CREATED_EVENT,
  COMMUNITY_POSTS_TOPIC,
  COMMUNITY_POSTS_WATCHING_EVENT,
  POST_LIKES_CHANGED_EVENT_NAME,
  POST_CREATED_EVENT_NAME,
  POST_LIKES_STREAM_PATH,
  buildPostLikeTogglePath,
};
