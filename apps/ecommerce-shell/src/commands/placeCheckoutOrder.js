/**
 * Places a checkout order from shell-owned cart and coupon state.
 * Role: Builds order payload, calls mesh order command, and clears cart on success.
 * Not in this file: Checkout remotes, cart line mutations, or coupon validation UI.
 * Key dependencies: src/commands/placeOrderViaMesh.js; src/events/localMeshEventBus.js; src/utils/cartActions.js.
 * See also: src/pages/checkoutPage.js; MESH_IMPLEMENTATIONS/remote-intents.md.
 */

import { getCartTotalValue } from "../utils/cartActions";
import { placeOrderViaMesh } from "./placeOrderViaMesh";
import { publishCartChanged } from "../events/localMeshEventBus";
import { navigate } from "../utils/navigate";

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
 * Places the current cart as an order via mesh and navigates on success.
 *
 * @param {object} appState - Shell state holding cart, coupon, products, and user.
 * @returns {Promise<void>}
 * @sideEffects May clear cart/coupon, publish cart.changed, and navigate to /order-placed.
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

  const orderResult = await placeOrderViaMesh({
    items: orderItems,
    subtotal: orderTotals.subtotal,
    discountAmount: orderTotals.discountAmount,
    totalAmount,
    appliedCoupon: appState.appliedCoupon,
    shippingAddress: appState.currentUser?.address || null,
  });

  if (!orderResult.ok) {
    return;
  }

  appState.cartItems = [];
  appState.appliedCoupon = null;
  publishCartChanged(appState.cartItems);
  navigate("/order-placed");
}

export { calculateCheckoutTotals, placeCheckoutOrder };
