/**
 * Defines the admin shell's live-notifications event contract.
 * Role: Names the admin topic and event names shared with the mock data service gateway.
 * Not in this file: The mesh subscription (src/events/adminLiveEvents.js).
 * Key dependencies: None.
 * See also: apps/mock-data-service/src/infrastructure/adminEventStream.js.
 */

const ADMIN_TOPIC = "admin";
const ADMIN_WATCHING_EVENT = "watching";
const ORDER_CREATED_EVENT_TYPE = "order_created";
const POST_CREATED_EVENT_TYPE = "post_created";
// Matches ADMIN_POST_LIKES_CHANGED_EVENT_TYPE in
// apps/mock-data-service/src/event-mesh/postLikeHandler.js, which broadcasts this type over
// the already-open admin/watching mesh subscription rather than a dotted SSE-style event name.
const POST_LIKES_CHANGED_EVENT_TYPE = "post_likes_changed";

export {
  ADMIN_TOPIC,
  ADMIN_WATCHING_EVENT,
  ORDER_CREATED_EVENT_TYPE,
  POST_CREATED_EVENT_TYPE,
  POST_LIKES_CHANGED_EVENT_TYPE,
};
