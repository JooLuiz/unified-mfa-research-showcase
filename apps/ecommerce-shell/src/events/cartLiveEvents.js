/**
 * Fans the ecommerce shell's live cart into local listeners.
 * Role: Subscribes to cart/live-changed and keeps the listener list cart sync already uses.
 * Not in this file: Applying the cart (src/utils/cartSync.js) or the ticket exchange.
 * Key dependencies: The shell event interface.
 * See also: src/main.js; src/events/eventEndpoints.js.
 */

/** @type {Set<(cart: object) => void>} */
const cartListeners = new Set();
let unsubscribeFromCart = null;

/**
 * Starts the live cart subscription when this tab is not already listening.
 *
 * @param {{ subscribe: Function }} transport - Event interface.
 * @returns {void}
 * @sideEffects Subscribes to cart/live-changed.
 */
function startCartLiveEvents(transport) {
  if (unsubscribeFromCart) {
    return;
  }
  unsubscribeFromCart = transport.subscribe("cart", "live-changed", (message) => {
    const cart = message.payload;
    cartListeners.forEach((listener) => listener(cart));
  });
}

/**
 * Stops the live cart subscription.
 *
 * @returns {void}
 * @sideEffects Unsubscribes from the transport.
 */
function stopCartLiveEvents() {
  if (unsubscribeFromCart) {
    unsubscribeFromCart();
    unsubscribeFromCart = null;
  }
}

/**
 * Subscribes to carts pushed on the live stream.
 *
 * @param {(cart: object) => void} listener - Called with each cart payload.
 * @returns {() => void} Unsubscribe function.
 * @sideEffects Registers the listener.
 */
function subscribeToCartLiveEvents(listener) {
  cartListeners.add(listener);
  return function unsubscribeFromCartLiveEvents() {
    cartListeners.delete(listener);
  };
}

export { startCartLiveEvents, stopCartLiveEvents, subscribeToCartLiveEvents };
