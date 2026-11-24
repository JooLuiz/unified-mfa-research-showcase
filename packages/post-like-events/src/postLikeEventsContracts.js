/**
 * Shared topic and event names for the post-like and post-created contract.
 * Role: Keeps the toggle command and the live updates on the same topics and event names as the
 *   mock API. `POST_CREATED_EVENT_NAME` travels on the same live connection as
 *   `POST_LIKES_CHANGED_EVENT_NAME`, matching the server's single social registry
 *   (apps/mock-data-service/src/infrastructure/postLikeEvents.js).
 * Not in this file: Paths (packages/server-events/src/eventEndpoints.js), the live connection, or
 *   the toggle write (src/togglePostLike.js). Both live behind the injected transport.
 * Key dependencies: None.
 * See also: apps/mock-data-service/src/routes/postRoutes.js;
 *   main: apps/mock-data-service/src/routes/postLikeRoutes.js;
 *   mesh: apps/mock-data-service/src/inbound/postLikeHandler.js.
 */

const COMMUNITY_LIKES_TOPIC = "community-likes";
const COMMUNITY_LIKES_CHANGED_EVENT = "changed";
const COMMUNITY_POSTS_TOPIC = "community-posts";
const COMMUNITY_POSTS_CREATED_EVENT = "created";
const POST_LIKES_CHANGED_EVENT_NAME = "community.post-likes-changed";
const POST_CREATED_EVENT_NAME = "community.post-created";

export {
  COMMUNITY_LIKES_CHANGED_EVENT,
  COMMUNITY_LIKES_TOPIC,
  COMMUNITY_POSTS_CREATED_EVENT,
  COMMUNITY_POSTS_TOPIC,
  POST_LIKES_CHANGED_EVENT_NAME,
  POST_CREATED_EVENT_NAME,
};
