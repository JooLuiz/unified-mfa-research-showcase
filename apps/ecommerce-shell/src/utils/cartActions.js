/**
 * Calculates cart totals and applies local cart edits.
 * Role: Owns in-memory cart math and the edits that schedule a saved-cart write.
 * Not in this file: HTTP cart commands or cross-tab sync (src/utils/cartSync.js).
 * Key dependencies: src/events/eventBus.js; src/utils/cartSync.js.
 * See also: src/utils/cartSync.js; src/pages/checkoutPage.js.
 */

import {
  publishCartChanged,
  publishCartItemAddRequested,
} from "../events/eventBus";
import { scheduleCartPersist } from "./cartSync";

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

export {
  getCartTotalValue,
  getCartItemCount,
  calculateCartTotals,
  getCartDiscountedTotal,
  dispatchAddToCartEvent,
  addCartItem,
  updateCartItem,
  removeCartItem,
};
