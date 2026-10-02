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
  dispatchAddToCartEvent,
  updateCartItem,
  removeCartItem,
};
