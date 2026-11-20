/**
 * Names the ecommerce shell's live cart event.
 * Role: Holds the cart event type name the live cart listener list uses.
 * Not in this file: The stream connection or cart state updates.
 * Key dependencies: None.
 * See also: src/events/cartLiveEvents.js; apps/mock-data-service/src/routes/cartRoutes.js.
 */

const CART_LIVE_EVENT_NAME = "ecommerce-shell:cart-live-event";
const CART_CHANGED_EVENT_TYPE = "cart_changed";

export { CART_CHANGED_EVENT_TYPE, CART_LIVE_EVENT_NAME };
