/**
 * Keeps the ecommerce shell cart aligned with the saved user cart.
 * Role: Hydrates and saves the signed-in cart, merges a guest cart at login, and applies carts from other tabs and the live stream.
 * Not in this file: HTTP request details (src/commands/cartCommands.js) or cart math (src/utils/cartActions.js).
 * Key dependencies: BroadcastChannel; localStorage auth key; src/commands/cartCommands.js; src/utils/cartPersist.js; src/utils/cartSnapshot.js.
 * See also: src/main.js; src/commands/placeCheckoutOrder.js.
 */

import { fetchSavedCart, saveSavedCart } from "../commands/cartCommands";
import { subscribeToCartLiveEvents } from "../events/cartLiveEvents";
import { publishCartChanged } from "../events/eventBus";
import { clearAuthSession } from "./authActions";
import { flushCartPersist, isCartPersistBusy, resumeCartPersist, runWithoutCartPersist, scheduleCartPersist, setCartSavedNotifier, suspendCartPersist } from "./cartPersist";
import { cloneAppliedCoupon, cloneCartItems, mergeCartItems } from "./cartSnapshot";
import { AUTH_TOKEN_STORAGE_KEY } from "./constants";

const CART_BROADCAST_CHANNEL_NAME = "ecommerce-shell:cart";
const cartTabId = `cart-tab-${Date.now()}-${Math.random().toString(16).slice(2)}`;

let cartChannel = null;
let storageListenerAttached = false;
let liveCartListenerAttached = false;
let lastAppliedCartUpdatedAt = null;

/**
 * Replaces shell cart state and notifies header and checkout listeners in this tab.
 *
 * @param {object} appState - Shell state holding cart items and the applied coupon.
 * @param {{ items: unknown, appliedCoupon: unknown }} cartSnapshot - Next cart contents.
 * @returns {void}
 * @sideEffects Mutates appState, window.__APP_SHELL_CART__, and publishes a cart change.
 */
function applyLocalCart(appState, cartSnapshot) {
  runWithoutCartPersist(() => {
    appState.cartItems = cloneCartItems(cartSnapshot.items);
    appState.appliedCoupon = cloneAppliedCoupon(cartSnapshot.appliedCoupon);
    window.__APP_SHELL_CART__ = appState.cartItems;
    publishCartChanged();
  });
}

/**
 * Applies a server cart when it is newer than the last one this tab accepted.
 *
 * @param {object} appState - Shell state for this tab.
 * @param {object | null | undefined} cart - Cart payload from GET /api/cart or cart_changed.
 * @returns {void}
 * @sideEffects May replace the local cart. Drops the payload while a local save is in progress.
 */
function applyServerCart(appState, cart) {
  if (!appState.authToken || isCartPersistBusy()) {
    return;
  }
  const incomingUpdatedAt = typeof cart?.updatedAt === "string" ? cart.updatedAt : null;
  const incomingIsOlder = Boolean(lastAppliedCartUpdatedAt)
    && (!incomingUpdatedAt || incomingUpdatedAt < lastAppliedCartUpdatedAt);
  if (incomingIsOlder) {
    return;
  }
  applyLocalCart(appState, {
    items: cart?.items,
    appliedCoupon: cart?.appliedCoupon,
  });
  if (incomingUpdatedAt) {
    lastAppliedCartUpdatedAt = incomingUpdatedAt;
  }
}

function forgetAppliedCartVersion() {
  lastAppliedCartUpdatedAt = null;
}

/**
 * Posts a cart snapshot to other ecommerce shell tabs.
 *
 * @param {object} message - Broadcast payload, including the source tab id.
 * @returns {void}
 * @sideEffects Posts on the cart BroadcastChannel when the channel is open.
 */
function postCartMessage(message) {
  if (!cartChannel) {
    return;
  }
  cartChannel.postMessage(message);
}

/**
 * Applies a cart or session message from another tab.
 *
 * @param {object} appState - Shell state for this tab.
 * @param {object | null} message - Broadcast payload.
 * @returns {void}
 * @sideEffects May replace the local cart or clear the in-memory session.
 */
function handleRemoteCartMessage(appState, message) {
  if (!message || message.sourceTabId === cartTabId) {
    return;
  }
  if (message.type === "session-ended") {
    if (!message.userId || message.userId !== appState.currentUser?.id) {
      return;
    }
    forgetAppliedCartVersion();
    applyLocalCart(appState, { items: [], appliedCoupon: null });
    clearAuthSession(appState);
    return;
  }
  if (message.type !== "cart-replaced" || message.userId !== appState.currentUser?.id) {
    return;
  }
  applyLocalCart(appState, {
    items: message.items,
    appliedCoupon: message.appliedCoupon,
  });
}

/**
 * Clears this tab when another tab removes the shared auth token.
 *
 * @param {object} appState - Shell state for this tab.
 * @returns {void}
 * @sideEffects Subscribes once to window storage events.
 */
function listenForLoggedOutStorage(appState) {
  if (storageListenerAttached) {
    return;
  }
  storageListenerAttached = true;
  window.addEventListener("storage", (storageEvent) => {
    if (storageEvent.key !== AUTH_TOKEN_STORAGE_KEY || storageEvent.newValue) {
      return;
    }
    if (!appState.authToken) {
      return;
    }
    forgetAppliedCartVersion();
    applyLocalCart(appState, { items: [], appliedCoupon: null });
    clearAuthSession(appState);
  });
}

/**
 * Applies cart_changed payloads from this user's live stream.
 *
 * @param {object} appState - Shell state for this tab.
 * @returns {void}
 * @sideEffects Subscribes once. Drops a payload while logged out, while a save is in progress, or when it is older than the last cart this tab applied.
 */
function listenForLiveCartChanges(appState) {
  if (liveCartListenerAttached) {
    return;
  }
  liveCartListenerAttached = true;
  subscribeToCartLiveEvents((cart) => {
    applyServerCart(appState, cart);
  });
}

function startCartTabSync(appState) {
  listenForLoggedOutStorage(appState);
  listenForLiveCartChanges(appState);
  if (cartChannel || typeof BroadcastChannel === "undefined") {
    return;
  }
  cartChannel = new BroadcastChannel(CART_BROADCAST_CHANNEL_NAME);
  cartChannel.onmessage = (channelEvent) => {
    handleRemoteCartMessage(appState, channelEvent.data);
  };
}

/**
 * Loads the saved cart into the shell before the first render.
 *
 * @param {object} appState - Shell state with an auth token, when the user is signed in.
 * @returns {Promise<void>}
 * @sideEffects Replaces local cart state when the read succeeds.
 */
async function hydrateSavedCart(appState) {
  if (!appState.authToken) {
    return;
  }
  const fetchedCart = await fetchSavedCart(appState.authToken);
  if (!fetchedCart.ok) {
    return;
  }
  applyServerCart(appState, fetchedCart.cart);
}

/**
 * Merges this tab's guest cart into the user's saved cart.
 *
 * @param {object} appState - Shell state whose cart may hold guest lines.
 * @param {string} authToken - Token from the login response, not yet stored on appState.
 * @param {string | null} userId - Signed-in user id used to address other tabs.
 * @returns {Promise<{ needsPersist: boolean }>} Whether the caller should save again after the session is stored.
 * @sideEffects Replaces local cart state. PUTs the merged cart when the guest tab contributed lines.
 * Note: A failed cart read leaves the guest lines in memory and does not overwrite the saved cart.
 */
async function mergeGuestCartOnLogin(appState, authToken, userId) {
  const guestItems = cloneCartItems(appState.cartItems);
  const guestCoupon = cloneAppliedCoupon(appState.appliedCoupon);
  const fetchedCart = await fetchSavedCart(authToken);
  if (!fetchedCart.ok) {
    return { needsPersist: false };
  }

  const mergedItems = mergeCartItems(fetchedCart.cart.items, guestItems);
  const appliedCoupon = guestCoupon || cloneAppliedCoupon(fetchedCart.cart.appliedCoupon);
  applyLocalCart(appState, { items: mergedItems, appliedCoupon });

  const guestContributed = guestItems.length > 0 || Boolean(guestCoupon);
  if (!guestContributed) {
    return { needsPersist: false };
  }

  const saveResult = await saveSavedCart(authToken, {
    items: mergedItems,
    appliedCoupon,
  });
  if (!saveResult.ok) {
    return { needsPersist: true };
  }
  postCartMessage({
    type: "cart-replaced",
    sourceTabId: cartTabId,
    userId,
    items: mergedItems,
    appliedCoupon,
  });
  return { needsPersist: false };
}

/**
 * Clears the cart in this tab and tells other tabs the saved cart is gone.
 *
 * @param {object} appState - Shell state for the signed-in user.
 * @returns {void}
 * @sideEffects Does not PUT an empty cart. The order write already removed the server row.
 */
function clearLocalCart(appState) {
  const userId = appState.currentUser?.id || null;
  applyLocalCart(appState, { items: [], appliedCoupon: null });
  postCartMessage({
    type: "cart-replaced",
    sourceTabId: cartTabId,
    userId,
    items: [],
    appliedCoupon: null,
  });
}

/**
 * Clears the in-memory cart and tells other tabs this user signed out.
 *
 * @param {object} appState - Shell state for the user who is signing out.
 * @returns {void}
 * @sideEffects Does not delete the saved cart row.
 */
function endCartSession(appState) {
  const userId = appState.currentUser?.id || null;
  forgetAppliedCartVersion();
  applyLocalCart(appState, { items: [], appliedCoupon: null });
  postCartMessage({
    type: "session-ended",
    sourceTabId: cartTabId,
    userId,
    items: [],
    appliedCoupon: null,
  });
}

setCartSavedNotifier((savedCart) => {
  postCartMessage({
    type: "cart-replaced",
    sourceTabId: cartTabId,
    userId: savedCart.userId,
    items: savedCart.items,
    appliedCoupon: savedCart.appliedCoupon,
  });
});

export {
  clearLocalCart,
  endCartSession,
  flushCartPersist,
  hydrateSavedCart,
  mergeGuestCartOnLogin,
  resumeCartPersist,
  scheduleCartPersist,
  startCartTabSync,
  suspendCartPersist,
};
