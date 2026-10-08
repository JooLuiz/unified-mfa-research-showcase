/**
 * Keeps the ecommerce shell cart aligned with the saved user cart.
 * Role: Hydrates and saves the signed-in cart, merges a guest cart at login, and applies carts pushed over Event Mesh.
 * Not in this file: Mesh publish details (src/commands/cartCommands.js) or cart math (src/utils/cartActions.js).
 * Key dependencies: localStorage auth key; src/commands/cartCommands.js; src/events/cartLiveEvents.js; src/utils/cartPersist.js.
 * See also: src/main.js; src/commands/placeCheckoutOrder.js.
 */

import { fetchSavedCart, saveSavedCart } from "../commands/cartCommands";
import { subscribeToCartLiveEvents } from "../events/cartLiveEvents";
import { publishCartChanged } from "../events/eventBus";
import { clearAuthSession } from "./authActions";
import { flushCartPersist, isCartPersistBusy, resumeCartPersist, runWithoutCartPersist, scheduleCartPersist, suspendCartPersist } from "./cartPersist";
import { cloneAppliedCoupon, cloneCartItems, mergeCartItems } from "./cartSnapshot";
import { AUTH_TOKEN_STORAGE_KEY } from "./constants";

let storageListenerAttached = false;
let liveCartListenerAttached = false;
let lastAppliedCartUpdatedAt = null;

/**
 * Replaces shell cart state and notifies header and checkout listeners in this tab.
 *
 * @param {object} appState - Shell state holding cart items and the applied coupon.
 * @param {{ items: unknown, appliedCoupon: unknown }} cartSnapshot - Next cart contents.
 * @returns {void}
 * @sideEffects Mutates appState and publishes a local cart change.
 */
function applyLocalCart(appState, cartSnapshot) {
  runWithoutCartPersist(() => {
    appState.cartItems = cloneCartItems(cartSnapshot.items);
    appState.appliedCoupon = cloneAppliedCoupon(cartSnapshot.appliedCoupon);
    publishCartChanged(appState.cartItems);
  });
}

/**
 * Applies a server cart when it is newer than the last one this tab accepted.
 *
 * @param {object} appState - Shell state for this tab.
 * @param {object | null | undefined} cart - Cart payload from GET /api/cart or cart-sync/changed.
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
 * Applies cart-sync/changed payloads from this user's live stream.
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

/**
 * Starts logout and live-cart listeners for this shell tab.
 *
 * @param {object} appState - Shell state that remote carts replace.
 * @returns {void}
 * @sideEffects Subscribes to storage events and cart-sync/changed.
 */
function startCartTabSync(appState) {
  listenForLoggedOutStorage(appState);
  listenForLiveCartChanges(appState);
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
 * @param {string} authToken - Token from the login response. The mesh credential must already match this user.
 * @param {string | null} _userId - Signed-in user id. Other tabs learn the merge from cart-sync/changed.
 * @returns {Promise<{ needsPersist: boolean }>} Whether the caller should save again after the session is stored.
 * @sideEffects Replaces local cart state. Publishes the merged cart when the guest tab contributed lines.
 * Note: A failed cart read leaves the guest lines in memory and does not overwrite the saved cart.
 */
async function mergeGuestCartOnLogin(appState, authToken, _userId) {
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
    if (typeof fetchedCart.cart.updatedAt === "string") {
      lastAppliedCartUpdatedAt = fetchedCart.cart.updatedAt;
    }
    return { needsPersist: false };
  }

  const saveResult = await saveSavedCart(authToken, {
    items: mergedItems,
    appliedCoupon,
  });
  if (!saveResult.ok) {
    return { needsPersist: true };
  }
  return { needsPersist: false };
}

/**
 * Clears the cart in this tab after an order removes the saved row.
 *
 * @param {object} appState - Shell state for the signed-in user.
 * @returns {void}
 * @sideEffects Does not publish cart-sync/upsert. The order handler already broadcasts the empty cart.
 */
function clearLocalCart(appState) {
  applyLocalCart(appState, { items: [], appliedCoupon: null });
}

/**
 * Clears the in-memory cart when this user signs out.
 *
 * @param {object} appState - Shell state for the user who is signing out.
 * @returns {void}
 * @sideEffects Does not delete the saved cart row. Other tabs notice the removed auth token.
 */
function endCartSession(appState) {
  forgetAppliedCartVersion();
  applyLocalCart(appState, { items: [], appliedCoupon: null });
}

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
