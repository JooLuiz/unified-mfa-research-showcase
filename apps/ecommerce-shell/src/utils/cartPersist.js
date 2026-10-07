/**
 * Queues signed-in cart writes so a newer edit replaces one still waiting.
 * Role: Coalesces PUT /api/cart and reports each successful save.
 * Not in this file: Cross-tab delivery (src/utils/cartSync.js) or cart math.
 * Key dependencies: src/commands/cartCommands.js; src/utils/cartSnapshot.js.
 * See also: src/utils/cartSync.js; src/commands/placeCheckoutOrder.js.
 */

import { saveSavedCart } from "../commands/cartCommands";
import { cloneAppliedCoupon, cloneCartItems } from "./cartSnapshot";

let applyingRemoteCart = false;
let cartPersistSuspended = false;
let persistTail = Promise.resolve();
let pendingSnapshot = null;
let persistWritesInFlight = 0;
let notifyCartSaved = function ignoreCartSaved() {};

/**
 * Registers the callback that runs after a cart PUT succeeds.
 *
 * @param {(snapshot: { userId: string | null, items: object[], appliedCoupon: object | null }) => void} notifier - Called with the saved snapshot.
 * @returns {void}
 */
function setCartSavedNotifier(notifier) {
  notifyCartSaved = notifier;
}

/**
 * Runs a local cart replacement without scheduling another save.
 *
 * @param {() => void} replaceCart - Updates shell cart state.
 * @returns {void}
 */
function runWithoutCartPersist(replaceCart) {
  applyingRemoteCart = true;
  try {
    replaceCart();
  } finally {
    applyingRemoteCart = false;
  }
}

/**
 * Drops a waiting save so an in-flight order cannot be overwritten by an older cart.
 *
 * @returns {void}
 */
function suspendCartPersist() {
  cartPersistSuspended = true;
  pendingSnapshot = null;
}

/**
 * Allows cart saves again after an order attempt finishes.
 *
 * @returns {void}
 */
function resumeCartPersist() {
  cartPersistSuspended = false;
}

/**
 * Writes the newest queued cart, then notifies the cart sync module.
 *
 * @returns {Promise<void>}
 * @sideEffects PUTs /api/cart when a snapshot is waiting.
 */
async function sendPendingCart() {
  if (!pendingSnapshot) {
    return;
  }
  const snapshot = pendingSnapshot;
  pendingSnapshot = null;
  persistWritesInFlight += 1;
  try {
    const saveResult = await saveSavedCart(snapshot.authToken, {
      items: snapshot.items,
      appliedCoupon: snapshot.appliedCoupon,
    });
    if (!saveResult.ok) {
      return;
    }
    notifyCartSaved({
      userId: snapshot.userId,
      items: snapshot.items,
      appliedCoupon: snapshot.appliedCoupon,
    });
  } finally {
    persistWritesInFlight -= 1;
  }
}

/**
 * Reports whether a cart save is waiting or already talking to the server.
 *
 * @returns {boolean} True while a newer local edit must not be replaced by a pushed cart.
 */
function isCartPersistBusy() {
  return pendingSnapshot !== null || persistWritesInFlight > 0;
}

/**
 * Queues a full-cart save for the signed-in user. A newer edit replaces one still waiting.
 *
 * @param {object} appState - Shell state holding the token, cart, and coupon.
 * @returns {void}
 * @sideEffects Schedules PUT /api/cart. Guest carts are not written.
 */
function scheduleCartPersist(appState) {
  if (cartPersistSuspended || applyingRemoteCart || !appState.authToken) {
    return;
  }
  pendingSnapshot = {
    authToken: appState.authToken,
    userId: appState.currentUser?.id || null,
    items: cloneCartItems(appState.cartItems),
    appliedCoupon: cloneAppliedCoupon(appState.appliedCoupon),
  };
  persistTail = persistTail.then(sendPendingCart).catch((error) => {
    console.warn("scheduleCartPersist - error");
    console.warn(error);
  });
}

/**
 * Waits until the latest queued cart save has finished.
 *
 * @returns {Promise<void>}
 */
async function flushCartPersist() {
  let observedTail = persistTail;
  await observedTail;
  while (observedTail !== persistTail) {
    observedTail = persistTail;
    await observedTail;
  }
}

export {
  flushCartPersist,
  isCartPersistBusy,
  resumeCartPersist,
  runWithoutCartPersist,
  scheduleCartPersist,
  setCartSavedNotifier,
  suspendCartPersist,
};
