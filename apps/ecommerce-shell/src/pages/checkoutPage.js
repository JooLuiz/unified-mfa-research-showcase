/**
 * Renders the checkout and order-placed routes.
 * Role: Composes checkout item, summary, and coupon mounts and owns the place-order flow outcome.
 * Not in this file: Order HTTP details (src/commands/orderCommands.js) or cart storage (src/utils/cartActions.js).
 * Key dependencies: Mock data service via src/commands/orderCommands.js; src/notifications/notificationBus.js.
 * See also: src/utils/renderActions.js (public barrel).
 */

import { navigate } from "../utils/navigate";
import {
  getCartTotalValue,
  updateCartItem,
  removeCartItem,
} from "../utils/cartActions";
import {
  isAuthenticated,
  rememberPostLoginRedirect,
} from "../utils/authActions";
import { MOCK_API_BASE_URL } from "../utils/constants";
import { notify } from "../notifications/notificationBus";
import { persistOrder } from "../commands/orderCommands";

/**
 * Renders checkout, awaiting order persistence before clearing the cart or navigating.
 *
 * @param {object} appState - Shell state holding cart, coupon, products, and session.
 * @param {HTMLElement} pageMount - Route container element.
 * @param {object} modules - Loaded remote module mount functions.
 * @param {Array<() => void>} activeCleanupFunctions - Cleanup registry for the current route.
 * @returns {Promise<void>}
 * @sideEffects On order success clears cart/coupon, notifies, and navigates; on failure notifies and keeps the cart.
 */
async function renderCheckoutPage(appState, pageMount, modules, activeCleanupFunctions) {
  if (!isAuthenticated(appState)) {
    rememberPostLoginRedirect("/checkout");
    navigate("/login");
    return;
  }

  if (appState.cartItems.length === 0) {
    pageMount.innerHTML = `<section id="checkoutEmptyMount"></section>`;
    const checkoutEmptyMount = pageMount.querySelector("#checkoutEmptyMount");
    activeCleanupFunctions.push(
      modules.mountCheckoutEmpty(checkoutEmptyMount, {
        onGoShopping: () => navigate("/products"),
      }),
    );
    return;
  }

  pageMount.innerHTML = `
    <section class="checkout-grid">
      <div id="checkoutItemsMount"></div>
      <div class="checkout-right-column">
        <div id="checkoutSummaryMount"></div>
        <div id="applyCouponMount"></div>
      </div>
    </section>
  `;

  const checkoutItemsMount = pageMount.querySelector("#checkoutItemsMount");
  const checkoutSummaryMount = pageMount.querySelector("#checkoutSummaryMount");
  const applyCouponMount = pageMount.querySelector("#applyCouponMount");

  const calculateTotals = () => {
    const currentSubtotal = getCartTotalValue(appState);
    const currentDiscountPercentage =
      appState.appliedCoupon?.discountPercentage || 0;
    const currentDiscountAmount =
      currentSubtotal * (currentDiscountPercentage / 100);
    return {
      subtotal: currentSubtotal,
      discountAmount: currentDiscountAmount,
    };
  };

  let checkoutSummaryHandle = null;
  const refreshCheckoutSummary = () => {
    if (!checkoutSummaryHandle) {
      return;
    }
    checkoutSummaryHandle.update(calculateTotals());
  };

  activeCleanupFunctions.push(
    modules.mountCheckoutItems(checkoutItemsMount, {
      productsById: appState.productsById,
      onQuantityChange: (productId, quantity) => {
        updateCartItem(appState, productId, quantity);
        refreshCheckoutSummary();
      },
      onRemoveItem: (productId) => {
        const productName = appState.productsById[productId]?.name || "Item";
        removeCartItem(appState, productId);
        notify({
          type: "success",
          title: "Item removed",
          message: `${productName} was removed from your cart.`,
        });
        if (appState.cartItems.length === 0) {
          window.dispatchEvent(new CustomEvent("global:renderApp"));
          return;
        }
        refreshCheckoutSummary();
      },
    }),
  );

  const initialTotals = calculateTotals();
  checkoutSummaryHandle = modules.mountCheckoutSummary(checkoutSummaryMount, {
    subtotal: initialTotals.subtotal,
    discountAmount: initialTotals.discountAmount,
      onPlaceOrder: async () => {
        const orderItems = appState.cartItems.map((cartItem) => {
          const product = appState.productsById[cartItem.productId];
          return {
            productId: cartItem.productId,
            name: product?.name || cartItem.productId,
            quantity: cartItem.quantity,
            unitPrice: product?.price || 0,
          };
        });
        const orderTotals = calculateTotals();
        const totalAmount = orderTotals.subtotal - orderTotals.discountAmount;

        const orderResult = await persistOrder(appState, {
          items: orderItems,
          subtotal: orderTotals.subtotal,
          discountAmount: orderTotals.discountAmount,
          totalAmount,
          appliedCoupon: appState.appliedCoupon,
          shippingAddress: appState.currentUser?.address || null,
        });

        if (!orderResult.ok) {
          notify({
            type: "error",
            title: "Order not placed",
            message: "Your cart is still available. Please try again.",
          });
          return;
        }

        appState.cartItems = [];
        appState.appliedCoupon = null;
        window.dispatchEvent(new CustomEvent("cart:updateGlobalCart"));
        notify({
          type: "success",
          title: "Order placed",
          message: "Your order has been created successfully.",
        });
        navigate("/order-placed");
      },
    });
  activeCleanupFunctions.push(() => checkoutSummaryHandle.unmount());

  activeCleanupFunctions.push(
    modules.mountApplyCoupon(applyCouponMount, {
      onCouponApplied: (couponPayload) => {
        appState.appliedCoupon = couponPayload;
        refreshCheckoutSummary();
      },
    }),
  );
}

/**
 * Renders the order-placed confirmation page.
 *
 * @param {HTMLElement} pageMount - Route container element.
 * @returns {Promise<void>}
 */
async function renderOrderPlacedPage(pageMount) {
  pageMount.innerHTML = `
    <section class="notice-box">
      <h2>Order Placed!</h2>
      <p>Thank you for your purchase.</p>
      <button id="continueShoppingButton" class="account-action-button" type="button">
        Continue shopping
      </button>
    </section>
  `;
  const continueShoppingButton = pageMount.querySelector("#continueShoppingButton");
  if (continueShoppingButton) {
    continueShoppingButton.addEventListener("click", () => navigate("/products"));
  }
}

export { renderCheckoutPage, renderOrderPlacedPage };
