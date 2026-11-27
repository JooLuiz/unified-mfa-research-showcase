/**
 * Renders the checkout and order-placed routes.
 * Role: Composes checkout item, summary, and coupon mounts and keeps the summary in step with the cart.
 * Not in this file: Coupon and place-order outcomes, which arrive as checkout intents
 *   (src/intents/checkoutIntentHandlers.js), or order HTTP details (src/commands/placeOrder.js).
 * Key dependencies: src/commands/placeCheckoutOrder.js totals. Cart line edits arrive as catalog
 *   intents (src/intents/catalogIntentHandlers.js).
 * See also: src/utils/renderActions.js (public barrel).
 */

import { publishRenderRequested, subscribeToCartChanges } from "../events/eventBus";
import { navigate } from "../utils/navigate";
import { MOCK_API_BASE_URL } from "../utils/constants";
import {
  isAuthenticated,
  rememberPostLoginRedirect,
} from "../utils/authActions";
import { calculateCheckoutTotals } from "../commands/placeCheckoutOrder";

/**
 * Renders checkout. The summary refreshes on every cart change, including an applied coupon.
 *
 * @param {object} appState - Shell state holding cart, coupon, products, and session.
 * @param {HTMLElement} pageMount - Route container element.
 * @param {object} modules - Loaded remote module mount functions.
 * @param {Array<() => void>} activeCleanupFunctions - Cleanup registry for the current route.
 * @returns {Promise<void>}
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
    modules.mountCheckoutEmpty(pageMount);
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
      cartItems: appState.cartItems,
      productsById: appState.productsById,
      apiBaseUrl: MOCK_API_BASE_URL,
      // Cart listeners are called with no payload. The line list reads the cart this page already committed.
      subscribeToCartChanges: (listener) =>
        subscribeToCartChanges(() => {
          listener(appState.cartItems);
        }),
    }),
  );

  const initialTotals = calculateCheckoutTotals(appState);
  checkoutSummaryHandle = modules.mountCheckoutSummary(checkoutSummaryMount, {
    subtotal: initialTotals.subtotal,
    discountAmount: initialTotals.discountAmount,
  });
  activeCleanupFunctions.push(() => checkoutSummaryHandle.unmount());

  activeCleanupFunctions.push(modules.mountApplyCoupon(applyCouponMount));
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
