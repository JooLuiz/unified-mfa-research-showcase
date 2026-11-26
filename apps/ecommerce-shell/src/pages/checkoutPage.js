/**
 * Renders the checkout and order-placed routes.
 * Role: Composes checkout item, summary, and coupon mounts and shows the failed-order toast.
 * Not in this file: Order HTTP details (src/commands/placeOrder.js) or the place-order sequence and post-order navigation (src/commands/placeCheckoutOrder.js).
 * Key dependencies: src/commands/placeCheckoutOrder.js; src/intents/catalogIntentHandlers.js (cart line edits);
 *   src/notifications/notificationAdapter.js; src/utils/cartSync.js.
 * See also: src/utils/renderActions.js (public barrel).
 */

import {
  publishCartChanged,
  publishRenderRequested,
  shellTransport,
  subscribeToCartChanges,
} from "../events/eventBus";
import { navigate } from "../utils/navigate";
import { scheduleCartPersist } from "../utils/cartSync";
import { MOCK_API_BASE_URL } from "../utils/constants";
import {
  isAuthenticated,
  rememberPostLoginRedirect,
} from "../utils/authActions";
import { publishNotification } from "../notifications/notificationAdapter";
import {
  calculateCheckoutTotals,
  placeCheckoutOrder,
} from "../commands/placeCheckoutOrder";
import { createCatalogIntentHandlers } from "../intents/catalogIntentHandlers";

/**
 * Renders checkout, awaiting order persistence before clearing the cart or navigating.
 *
 * @param {object} appState - Shell state holding cart, coupon, products, and session.
 * @param {HTMLElement} pageMount - Route container element.
 * @param {object} modules - Loaded remote module mount functions.
 * @param {Array<() => void>} activeCleanupFunctions - Cleanup registry for the current route.
 * @returns {Promise<void>}
 * @sideEffects On order failure shows an error toast; the command navigates on success.
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

  const catalogHandlers = createCatalogIntentHandlers(appState);
  const checkoutItemsHandle = modules.mountCheckoutItems(checkoutItemsMount, {
    productsById: appState.productsById,
    apiBaseUrl: MOCK_API_BASE_URL,
    onQuantityChange: async (productId, quantity) => {
      const stockCheckResult = await catalogHandlers.onCartItemUpdateRequested({
        productId,
        quantity,
      });
      if (!stockCheckResult.ok) {
        return;
      }
      checkoutItemsHandle.applyAvailable(productId, stockCheckResult.available);
      refreshCheckoutSummary();
    },
    onRemoveItem: async (productId) => {
      const stockCheckResult = await catalogHandlers.onCartItemRemoveRequested({ productId });
      if (!stockCheckResult.ok) {
        return;
      }
      checkoutItemsHandle.applyAvailable(productId, stockCheckResult.available);
      if (appState.cartItems.length > 0) {
        refreshCheckoutSummary();
      }
    },
  });
  activeCleanupFunctions.push(() => checkoutItemsHandle.unmount());

  const initialTotals = calculateCheckoutTotals(appState);
  checkoutSummaryHandle = modules.mountCheckoutSummary(checkoutSummaryMount, {
    subtotal: initialTotals.subtotal,
    discountAmount: initialTotals.discountAmount,
    onPlaceOrder: async () => {
      const orderResult = await placeCheckoutOrder(shellTransport, appState);
      if (!orderResult.ok) {
        publishNotification({
          type: "error",
          title: "Order not placed",
          message: "Your cart is still available. Please try again.",
        });
      }
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
