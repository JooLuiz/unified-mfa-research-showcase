/**
 * Places a checkout order from shell-owned cart and coupon state.
 * Role: Builds the order payload, calls the HTTP order command, and clears the cart on success.
 * Not in this file: Checkout remotes, toast copy, or post-order navigation (src/pages/checkoutPage.js).
 * Key dependencies: src/commands/placeOrder.js; src/events/eventBus.js; src/utils/cartActions.js.
 * See also: src/pages/checkoutPage.js.
 */

import { publishCartChanged } from "../events/eventBus";
import { getCartTotalValue } from "../utils/cartActions";
import { placeOrder } from "./placeOrder";

/**
 * Calculates checkout subtotal and discount from shell state.
 *
 * @param {object} appState - Shell state with cart, coupon, and products.
 * @returns {{ subtotal: number, discountAmount: number }} Current totals.
 */
function calculateCheckoutTotals(appState) {
  const subtotal = getCartTotalValue(appState);
  const discountPercentage = appState.appliedCoupon?.discountPercentage || 0;
  const discountAmount = subtotal * (discountPercentage / 100);
  return { subtotal, discountAmount };
}

/**
 * Places the current cart as an order and clears the cart when the server accepts it.
 *
 * @param {object} appState - Shell state holding cart, coupon, products, and user.
 * @returns {Promise<{ ok: boolean }>} Whether the server accepted the order.
 * @sideEffects On success clears cart and coupon and publishes a cart change.
 */
async function placeCheckoutOrder(appState) {
  const orderItems = appState.cartItems.map((cartItem) => {
    const product = appState.productsById[cartItem.productId];
    return {
      productId: cartItem.productId,
      name: product?.name || cartItem.productId,
      quantity: cartItem.quantity,
      unitPrice: product?.price || 0,
    };
  });
  const orderTotals = calculateCheckoutTotals(appState);
  const totalAmount = orderTotals.subtotal - orderTotals.discountAmount;

  const orderResult = await placeOrder(appState, {
    items: orderItems,
    subtotal: orderTotals.subtotal,
    discountAmount: orderTotals.discountAmount,
    totalAmount,
    appliedCoupon: appState.appliedCoupon,
    shippingAddress: appState.currentUser?.address || null,
  });

  if (!orderResult.ok) {
    return { ok: false };
  }

  appState.cartItems = [];
  appState.appliedCoupon = null;
  publishCartChanged();
  return { ok: true };
}

export { calculateCheckoutTotals, placeCheckoutOrder };
