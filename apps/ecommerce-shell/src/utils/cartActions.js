import {
  publishCartChanged,
  publishCartItemAddRequested,
} from "../events/eventBus";

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

function updateCartItem(appState, productId, quantity) {
  const existingItem = appState.cartItems.find(
    (cartItem) => cartItem.productId === productId,
  );
  if (existingItem) {
    existingItem.quantity = quantity;
  } else {
    appState.cartItems.push({ productId, quantity });
  }
  window.__APP_SHELL_CART__ = appState.cartItems;
  publishCartChanged();
}

function removeCartItem(appState, productId) {
  appState.cartItems = appState.cartItems.filter(
    (cartItem) => cartItem.productId !== productId,
  );
  window.__APP_SHELL_CART__ = appState.cartItems;
  publishCartChanged();
}

export {
  getCartTotalValue,
  getCartItemCount,
  calculateCartTotals,
  getCartDiscountedTotal,
  dispatchAddToCartEvent,
  updateCartItem,
  removeCartItem,
};
