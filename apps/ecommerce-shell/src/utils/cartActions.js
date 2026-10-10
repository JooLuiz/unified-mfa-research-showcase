/**
 * Calculates cart totals and applies local cart edits.
 * Role: Owns in-memory cart math, the edits that schedule a saved-cart write, and the
 *   stock-gated variants of those edits that reserve or release stock before applying locally.
 * Not in this file: HTTP cart commands or cross-tab sync (src/utils/cartSync.js).
 * Key dependencies: src/events/eventBus.js; src/utils/cartSync.js; @shared/stock-events.
 * See also: src/utils/cartSync.js; src/pages/checkoutPage.js; src/main.js.
 */

import { getOrCreateGuestStockSessionId, reserveStockQuantity, setStockQuantity } from "@shared/stock-events";
import {
  publishCartChanged,
  publishCartItemAddRequested,
} from "../events/eventBus";
import { publishNotification } from "../notifications/notificationAdapter";
import { scheduleCartPersist } from "./cartSync";
import { MOCK_API_BASE_URL } from "./constants";

const STOCK_ISSUE_NOTIFICATION_MESSAGE =
  "Looks like there's a stock issue with this product, please try again later.";

function getCartTotalValue(appState) {
  return appState.cartItems.reduce((totalValue, cartItem) => {
    const product = appState.productsById[cartItem.productId];
    if (!product) {
      return totalValue;
    }
    return totalValue + product.price * cartItem.quantity;
  }, 0);
}

function getCartItemCount(appState) {
  return appState.cartItems.reduce(
    (currentCount, cartItem) => currentCount + cartItem.quantity,
    0,
  );
}

/**
 * Calculates cart subtotal, coupon discount, and net discounted total.
 *
 * @param {object} appState - Shell state holding cart items, products, and an optional coupon.
 * @returns {{ subtotal: number, discountAmount: number, totalAmount: number }} Current cart totals.
 */
function calculateCartTotals(appState) {
  const subtotal = getCartTotalValue(appState);
  const discountPercentage = appState.appliedCoupon?.discountPercentage || 0;
  const discountAmount = subtotal * (discountPercentage / 100);
  const totalAmount = Math.max(subtotal - discountAmount, 0);
  return { subtotal, discountAmount, totalAmount };
}

/**
 * Returns the cart's net total after any applied coupon discount.
 *
 * @param {object} appState - Shell state holding cart items, products, and an optional coupon.
 * @returns {number} Discounted cart total.
 */
function getCartDiscountedTotal(appState) {
  return calculateCartTotals(appState).totalAmount;
}

function dispatchAddToCartEvent(addToCartPayload) {
  publishCartItemAddRequested(addToCartPayload);
}

/**
 * Publishes the current cart and queues a save when the shopper is signed in.
 *
 * @param {object} appState - Shell state holding cart items.
 * @returns {void}
 * @sideEffects Updates window.__APP_SHELL_CART__ and may PUT /api/cart.
 */
function commitCartState(appState) {
  window.__APP_SHELL_CART__ = appState.cartItems;
  publishCartChanged();
  scheduleCartPersist(appState);
}

/**
 * Adds a quantity of a product to the shell cart.
 *
 * @param {object} appState - Shell state holding cart items.
 * @param {string} productId - Catalog product id.
 * @param {number} quantityToAdd - Positive quantity to add. Values below 1 become 1.
 * @returns {void}
 * @sideEffects Mutates the cart and schedules a save for a signed-in user.
 */
function addCartItem(appState, productId, quantityToAdd) {
  const quantityValue =
    Number.isFinite(quantityToAdd) && quantityToAdd > 0 ? quantityToAdd : 1;
  const existingItem = appState.cartItems.find(
    (cartItem) => cartItem.productId === productId,
  );
  if (existingItem) {
    existingItem.quantity += quantityValue;
  } else {
    appState.cartItems.push({ productId, quantity: quantityValue });
  }
  commitCartState(appState);
}

/**
 * Sets the quantity of one product, adding the line when it is missing.
 *
 * @param {object} appState - Shell state holding cart items.
 * @param {string} productId - Catalog product id.
 * @param {number} quantity - Next quantity for that product.
 * @returns {void}
 * @sideEffects Mutates the cart and schedules a save for a signed-in user.
 */
function updateCartItem(appState, productId, quantity) {
  const existingItem = appState.cartItems.find(
    (cartItem) => cartItem.productId === productId,
  );
  if (existingItem) {
    existingItem.quantity = quantity;
  } else {
    appState.cartItems.push({ productId, quantity });
  }
  commitCartState(appState);
}

/**
 * Removes one product from the shell cart.
 *
 * @param {object} appState - Shell state holding cart items.
 * @param {string} productId - Catalog product id to remove.
 * @returns {void}
 * @sideEffects Mutates the cart and schedules a save for a signed-in user.
 */
function removeCartItem(appState, productId) {
  appState.cartItems = appState.cartItems.filter(
    (cartItem) => cartItem.productId !== productId,
  );
  commitCartState(appState);
}

/**
 * Returns the stock caller identity for the current shopper.
 *
 * @param {object} appState - Shell state holding an optional auth token.
 * @returns {{ authToken: string } | { guestSessionId: string }} Exactly one identity field.
 */
function getStockHolderIdentity(appState) {
  if (appState.authToken) {
    return { authToken: appState.authToken };
  }
  return { guestSessionId: getOrCreateGuestStockSessionId() };
}

/**
 * Adds a quantity to the cart only after the server grants the matching stock reservation.
 *
 * @param {object} appState - Shell state holding cart items and an optional auth token.
 * @param {string} productId - Catalog product id.
 * @param {number} quantityToAdd - Positive quantity to add. Values below 1 become 1.
 * @returns {Promise<{ ok: true, quantity: number, available: number } | { ok: false, code: string }>} Server outcome.
 * @sideEffects POSTs a stock reservation; mutates the cart and schedules a save only on success.
 */
async function addCartItemWithStockCheck(appState, productId, quantityToAdd) {
  const quantityValue =
    Number.isFinite(quantityToAdd) && quantityToAdd > 0 ? quantityToAdd : 1;
  const reservationResult = await reserveStockQuantity({
    apiBaseUrl: MOCK_API_BASE_URL,
    ...getStockHolderIdentity(appState),
    productId,
    quantity: quantityValue,
  });
  if (!reservationResult.ok) {
    return reservationResult;
  }
  addCartItem(appState, productId, quantityValue);
  return reservationResult;
}

/**
 * Sets one product's cart quantity only after the server grants the matching stock hold.
 * A quantity of 0 releases the hold and removes the line.
 *
 * @param {object} appState - Shell state holding cart items and an optional auth token.
 * @param {string} productId - Catalog product id.
 * @param {number} quantity - Next absolute quantity for that product.
 * @returns {Promise<{ ok: true, quantity: number, available: number } | { ok: false, code: string }>} Server outcome.
 * @sideEffects PUTs an absolute stock hold; mutates the cart and schedules a save only on success.
 */
async function setCartItemQuantityWithStockCheck(appState, productId, quantity) {
  const quantityValue = Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
  const reservationResult = await setStockQuantity({
    apiBaseUrl: MOCK_API_BASE_URL,
    ...getStockHolderIdentity(appState),
    productId,
    quantity: quantityValue,
  });
  if (!reservationResult.ok) {
    return reservationResult;
  }
  if (quantityValue === 0) {
    removeCartItem(appState, productId);
  } else {
    updateCartItem(appState, productId, quantityValue);
  }
  return reservationResult;
}

/**
 * Re-sends every guest cart line's absolute quantity after the shared stock stream reconnects,
 * since a dropped guest connection releases that session's holds on the server.
 *
 * @param {object} appState - Shell state holding cart items; a no-op for signed-in shoppers.
 * @returns {Promise<void>}
 * @sideEffects PUTs one absolute stock hold per guest cart line; removes lines the server can no
 *   longer reserve and shows the stock notification once when that happens.
 */
async function reReserveGuestCartLines(appState) {
  if (appState.authToken || appState.cartItems.length === 0) {
    return;
  }

  const guestSessionId = getOrCreateGuestStockSessionId();
  const cartItemsSnapshot = [...appState.cartItems];
  let anyLineRemoved = false;

  for (const cartItem of cartItemsSnapshot) {
    const reservationResult = await setStockQuantity({
      apiBaseUrl: MOCK_API_BASE_URL,
      guestSessionId,
      productId: cartItem.productId,
      quantity: cartItem.quantity,
    });
    if (!reservationResult.ok) {
      removeCartItem(appState, cartItem.productId);
      anyLineRemoved = true;
    }
  }

  if (anyLineRemoved) {
    publishNotification({
      type: "error",
      title: "Stock issue",
      message: STOCK_ISSUE_NOTIFICATION_MESSAGE,
    });
  }
}

export {
  STOCK_ISSUE_NOTIFICATION_MESSAGE,
  getCartTotalValue,
  getCartItemCount,
  calculateCartTotals,
  getCartDiscountedTotal,
  dispatchAddToCartEvent,
  addCartItem,
  updateCartItem,
  removeCartItem,
  addCartItemWithStockCheck,
  setCartItemQuantityWithStockCheck,
  reReserveGuestCartLines,
};
