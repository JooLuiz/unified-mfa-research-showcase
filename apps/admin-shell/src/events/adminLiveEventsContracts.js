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

export {
  ADMIN_TOPIC,
  ADMIN_WATCHING_EVENT,
  ORDER_CREATED_EVENT_TYPE,
  POST_CREATED_EVENT_TYPE,
};
