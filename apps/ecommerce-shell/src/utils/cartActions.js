/**
 * Calculates and mutates ecommerce cart state through local mesh messages.
 * Role: Provides cart helpers and publishes shell-owned cart state events after mutations.
 * Not in this file: Cart command handling from remotes (catalog intents), header rendering, or Checkout MFE subscriptions.
 * Key dependencies: src/events/eventBus.js.
 * See also: src/main.js; src/pages/checkoutPage.js.
 */

import { publishCartChanged } from "../events/eventBus";

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

function updateCartItem(appState, productId, quantity) {
  const existingItem = appState.cartItems.find(
    (cartItem) => cartItem.productId === productId,
  );
  if (existingItem) {
    existingItem.quantity = quantity;
  } else {
    appState.cartItems.push({ productId, quantity });
  }
  publishCartChanged(appState.cartItems);
}

function removeCartItem(appState, productId) {
  appState.cartItems = appState.cartItems.filter(
    (cartItem) => cartItem.productId !== productId,
  );
  publishCartChanged(appState.cartItems);
}

export {
  getCartTotalValue,
  getCartItemCount,
  updateCartItem,
  removeCartItem,
};
