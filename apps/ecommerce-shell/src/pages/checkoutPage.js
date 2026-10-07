/**
 * Renders the checkout and order-placed routes.
 * Role: Composes checkout item, summary, and coupon mounts and owns the place-order flow outcome.
 * Not in this file: Order HTTP details (src/commands/placeOrder.js) or the place-order sequence (src/commands/placeCheckoutOrder.js).
 * Key dependencies: src/commands/placeCheckoutOrder.js; src/notifications/notificationAdapter.js; src/utils/cartSync.js.
 * See also: src/utils/renderActions.js (public barrel).
 */

import { publishCartChanged, publishRenderRequested, subscribeToCartChanges } from "../events/eventBus";
import { navigate } from "../utils/navigate";
import { updateCartItem, removeCartItem } from "../utils/cartActions";
import { scheduleCartPersist } from "../utils/cartSync";
import {
  isAuthenticated,
  rememberPostLoginRedirect,
} from "../utils/authActions";
import { publishNotification } from "../notifications/notificationAdapter";
import {
  calculateCheckoutTotals,
  placeCheckoutOrder,
} from "../commands/placeCheckoutOrder";

/**
 * Renders checkout, awaiting order persistence before clearing the cart or navigating.
 *
 * @param {object} appState - Shell state holding cart, coupon, products, and session.
 * @param {HTMLElement} pageMount - Route container element.
 * @param {object} modules - Loaded remote module mount functions.
 * @param {Array<() => void>} activeCleanupFunctions - Cleanup registry for the current route.
 * @returns {Promise<void>}
 * @sideEffects On order success notifies and navigates; on failure notifies and keeps the cart.
 */
async function renderCheckoutPage(appState, pageMount, modules, activeCleanupFunctions) {
  if (!isAuthenticated(appState)) {
    rememberPostLoginRedirect("/checkout");
    navigate("/login");
    return;
  }

  let checkoutSummaryHandle = null;
  const refreshCheckoutSummary = () => {
    if (!checkoutSummaryHandle) {
      return;
    }
    checkoutSummaryHandle.update(calculateCheckoutTotals(appState));
  };
  let renderedItemCount = appState.cartItems.length;
  activeCleanupFunctions.push(
    subscribeToCartChanges(() => {
      const nextItemCount = appState.cartItems.length;
      const emptinessChanged = (renderedItemCount === 0) !== (nextItemCount === 0);
      renderedItemCount = nextItemCount;
      if (emptinessChanged) {
        publishRenderRequested();
        return;
      }
      refreshCheckoutSummary();
    }),
  );

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
        publishNotification({
          type: "success",
          title: "Item removed",
          message: `${productName} was removed from your cart.`,
        });
        if (appState.cartItems.length > 0) {
          refreshCheckoutSummary();
        }
      },
    }),
  );

  const initialTotals = calculateCheckoutTotals(appState);
  checkoutSummaryHandle = modules.mountCheckoutSummary(checkoutSummaryMount, {
    subtotal: initialTotals.subtotal,
    discountAmount: initialTotals.discountAmount,
    onPlaceOrder: async () => {
      const orderResult = await placeCheckoutOrder(appState);
      if (!orderResult.ok) {
        publishNotification({
          type: "error",
          title: "Order not placed",
          message: "Your cart is still available. Please try again.",
        });
        return;
      }

      publishNotification({
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
        publishCartChanged();
        scheduleCartPersist(appState);
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
