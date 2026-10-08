/**
 * Places a checkout order from shell-owned cart and coupon state.
 * Role: Builds the order payload, calls the mesh order command, and clears the cart on success.
 * Not in this file: Checkout remotes, cart line mutations, or coupon validation UI.
 * Key dependencies: src/commands/placeOrder.js; src/utils/cartActions.js; src/utils/cartSync.js.
 * See also: src/pages/checkoutPage.js; MESH_IMPLEMENTATIONS/remote-intents.md.
 */

import { calculateCartTotals } from "../utils/cartActions";
import { clearLocalCart, flushCartPersist, resumeCartPersist, scheduleCartPersist, suspendCartPersist } from "../utils/cartSync";
import { placeOrder } from "./placeOrder";
import { navigate } from "../utils/navigate";

/**
 * Calculates checkout subtotal and discount from shell state.
 *
 * @param {object} appState - Shell state with cart, coupon, and products.
 * @returns {{ subtotal: number, discountAmount: number }} Current totals.
 */
function calculateCheckoutTotals(appState) {
  const { subtotal, discountAmount } = calculateCartTotals(appState);
  return { subtotal, discountAmount };
}

/**
 * Places the current cart as an order via mesh and navigates on success.
 *
 * @param {object} appState - Shell state holding cart, coupon, products, and user.
 * @returns {Promise<{ ok: boolean }>} Whether the server accepted the order.
 * @sideEffects On success clears the local cart and navigates to /order-placed. The order write removes the saved row and pushes an empty cart.
 */
async function placeCheckoutOrder(appState) {
  await flushCartPersist();
  suspendCartPersist();
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
    resumeCartPersist();
    scheduleCartPersist(appState);
    return { ok: false };
  }

  clearLocalCart(appState);
  resumeCartPersist();
  navigate("/order-placed");
  return { ok: true };
}

export { calculateCheckoutTotals, placeCheckoutOrder };
