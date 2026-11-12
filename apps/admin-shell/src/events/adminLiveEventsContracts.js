/**
 * Defines the admin shell's live-notifications event contract.
 * Role: Names the window CustomEvent used to fan out SSE-sourced events to pages, and the
 *   event types the mock data service broadcasts.
 * Not in this file: The EventSource connection or the public subscribe API
 *   (src/events/adminLiveEvents.js).
 * Key dependencies: None.
 * See also: apps/mock-data-service/src/routes/adminRoutes.js (GET /admin/events).
 */

const ADMIN_LIVE_EVENT_NAME = "admin-shell:live-data-event";

const ORDER_CREATED_EVENT_TYPE = "order_created";
const POST_CREATED_EVENT_TYPE = "post_created";
const POST_LIKES_CHANGED_EVENT_TYPE = "community.post-likes-changed";

export {
  ADMIN_LIVE_EVENT_NAME,
  ORDER_CREATED_EVENT_TYPE,
  POST_CREATED_EVENT_TYPE,
  POST_LIKES_CHANGED_EVENT_TYPE,
};
