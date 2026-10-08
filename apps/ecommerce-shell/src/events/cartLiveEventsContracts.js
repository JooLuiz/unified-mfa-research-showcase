/**
 * Names the ecommerce shell's saved-cart mesh events.
 * Role: Holds the cart-sync topic and event names shared with the gateway.
 * Not in this file: The mesh subscription or cart state updates.
 * Key dependencies: None.
 * See also: src/events/cartLiveEvents.js; apps/mock-data-service/src/event-mesh/cartUpsertHandler.js.
 */

const CART_SYNC_TOPIC = "cart-sync";
const CART_WATCHING_EVENT = "watching";
const CART_CHANGED_EVENT_TYPE = "changed";
const CART_UPSERT_EVENT = "upsert";
const CART_UPSERT_REJECTED_EVENT = "upsert-rejected";

export {
  CART_CHANGED_EVENT_TYPE,
  CART_SYNC_TOPIC,
  CART_UPSERT_EVENT,
  CART_UPSERT_REJECTED_EVENT,
  CART_WATCHING_EVENT,
};
