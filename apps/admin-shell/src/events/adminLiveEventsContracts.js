/**
 * Defines the admin shell's live-notifications event contract.
 * Role: Names the window CustomEvent used to fan out mesh admin activity to pages, and the
 *   topic and event names shared with the mock data service gateway.
 * Not in this file: Transport (src/events/adminLiveEventsTransport.js) or public API
 *   (src/events/adminLiveEvents.js).
 * Key dependencies: None.
 * See also: apps/mock-data-service/src/infrastructure/adminEventStream.js.
 */

const ADMIN_LIVE_EVENT_NAME = "admin-shell:live-data-event";

const ADMIN_TOPIC = "admin";
const ADMIN_WATCHING_EVENT = "watching";
const ORDER_CREATED_EVENT_TYPE = "order_created";
const POST_CREATED_EVENT_TYPE = "post_created";

export {
  ADMIN_LIVE_EVENT_NAME,
  ADMIN_TOPIC,
  ADMIN_WATCHING_EVENT,
  ORDER_CREATED_EVENT_TYPE,
  POST_CREATED_EVENT_TYPE,
};
