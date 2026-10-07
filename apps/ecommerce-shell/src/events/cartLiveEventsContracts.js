/**
 * Names the ecommerce shell's live cart event.
 * Role: Holds the window event used to fan a pushed cart into the shell.
 * Not in this file: The EventSource connection or cart state updates.
 * Key dependencies: None.
 * See also: src/events/cartLiveEventsTransport.js; apps/mock-data-service/src/routes/cartRoutes.js.
 */

const CART_LIVE_EVENT_NAME = "ecommerce-shell:cart-live-event";
const CART_CHANGED_EVENT_TYPE = "cart_changed";

export { CART_CHANGED_EVENT_TYPE, CART_LIVE_EVENT_NAME };
