/**
 * Fans the ecommerce shell's live cart into local listeners.
 * Role: Subscribes to cart/live-changed, announces cart-sync/watching, and keeps the listener list cart sync already uses.
 * Not in this file: Applying the cart (src/utils/cartSync.js) or the ticket exchange.
 * Key dependencies: The shell event interface.
 * See also: src/main.js; src/events/eventEndpoints.js.
 */

import { CART_SYNC_TOPIC, CART_WATCHING_EVENT } from "./cartLiveEventsContracts.js";

const MESH_CONNECT_TIMEOUT_MS = 5000;

/** @type {Set<(cart: object) => void>} */
const cartListeners = new Set();
let unsubscribeFromCart = null;

/**
 * Registers this tab for saved-cart pushes once the socket is open.
 *
 * @param {{ publish?: Function, whenConnected?: Function }} transport - Event interface. A subscribe-only fake is ignored.
 * @returns {void}
 * @sideEffects Publishes cart-sync/watching. A connect timeout is swallowed; this tab then misses live carts until the next start.
 */
function publishCartWatching(transport) {
  if (!openTransport(transport)) {
    return;
  }
  transport.publish({
    topic: CART_SYNC_TOPIC,
    event: CART_WATCHING_EVENT,
    payload: {},
    scope: "distributed",
  });
}

/**
 * Starts the socket for a transport that can publish. A subscribe-only fake is skipped.
 *
 * @param {{ publish?: Function, whenConnected?: Function }} transport - Event interface.
 * @returns {boolean} True when the caller should publish.
 * @sideEffects Calls whenConnected. A closed client or a connect timeout does not throw.
 */
function openTransport(transport) {
  if (typeof transport.publish !== "function" || typeof transport.whenConnected !== "function") {
    return false;
  }
  try {
    const connected = transport.whenConnected({ timeoutMs: MESH_CONNECT_TIMEOUT_MS });
    if (connected && typeof connected.catch === "function") {
      connected.catch(() => {
        // The gateway only pushes to registered clients. The next start can register again.
      });
    }
  } catch {
    return false;
  }
  return true;
}

/**
 * Starts the live cart subscription when this tab is not already listening.
 *
 * @param {{ subscribe: Function, publish?: Function, whenConnected?: Function }} transport - Event interface.
 * @returns {void}
 * @sideEffects Subscribes to cart/live-changed and publishes cart-sync/watching.
 */
function startCartLiveEvents(transport) {
  if (unsubscribeFromCart) {
    return;
  }
  publishCartWatching(transport);
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
