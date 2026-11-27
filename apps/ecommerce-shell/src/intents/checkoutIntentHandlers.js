/**
 * Handles the shopper's coupon and place-order requests from the checkout remotes.
 * Role: One place for the cart and toast outcome of each checkout request. The shell registers
 *   these as checkout intent listeners.
 * Not in this file: How a request reaches the shell, the order HTTP call, or summary rendering.
 * Key dependencies: src/commands/placeCheckoutOrder.js; src/utils/cartSync.js;
 *   src/notifications/notificationAdapter.js; src/events/eventBus.js.
 * See also: src/pages/checkoutPage.js; src/intents/catalogIntentHandlers.js.
 */

import { placeCheckoutOrder } from "../commands/placeCheckoutOrder";
import { publishNotification } from "../notifications/notificationAdapter";
import { scheduleCartPersist } from "../utils/cartSync";
import { publishCartChanged, shellTransport } from "../events/eventBus";

const ORDER_FAILED_NOTIFICATION = {
  type: "error",
  title: "Order not placed",
  message: "Your cart is still available. Please try again.",
};

/**
 * Creates the checkout request handlers for one shell state.
 *
 * @param {object} appState - Shell state holding the cart, coupon, products, and session.
 * @param {{
 *   getTransport?: () => object,
 *   placeOrder?: (transport: object, appState: object) => Promise<{ ok: boolean }>,
 *   notify?: (notification: object) => void,
 *   announceCartChanged?: () => void,
 *   persistCart?: (appState: object) => void,
 * }} [dependencies] - Collaborators. They default to the shell's own. getTransport is read on
 *   every order, so a transport installed after startup is used.
 * @returns {{
 *   onCouponApplied: (coupon: { code: string, discountPercentage: number }) => void,
 *   onPlaceOrderRequested: () => Promise<{ ok: boolean }>,
 * }} Handlers. The place-order handler resolves to the order outcome.
 */
function createCheckoutIntentHandlers(
  appState,
  {
    getTransport = () => shellTransport,
    placeOrder = placeCheckoutOrder,
    notify = publishNotification,
    announceCartChanged = publishCartChanged,
    persistCart = scheduleCartPersist,
  } = {},
) {
  return {
    onCouponApplied(coupon) {
      appState.appliedCoupon = coupon;
      // Cart listeners refresh the header and the checkout summary.
      announceCartChanged();
      persistCart(appState);
    },
    async onPlaceOrderRequested() {
      const orderResult = await placeOrder(getTransport(), appState);
      if (!orderResult.ok) {
        notify(ORDER_FAILED_NOTIFICATION);
      }
      return orderResult;
    },
  };
}

export { createCheckoutIntentHandlers };
