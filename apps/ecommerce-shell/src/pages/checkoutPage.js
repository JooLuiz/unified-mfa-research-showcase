/**
 * Renders the checkout and order-placed routes.
 * Role: Composes checkout remotes with data/inbound adapters; cart/coupon/place-order intents come from mesh.
 * Not in this file: Persistent mesh handlers (src/main.js) or place-order command (src/commands/placeCheckoutOrder.js).
 * Key dependencies: src/events/localMeshEventBus.js; checkout remotes.
 * See also: src/utils/renderActions.js (public barrel); MESH_IMPLEMENTATIONS/remote-intents.md.
 */

import { navigate } from "../utils/navigate";
import {
  isAuthenticated,
  rememberPostLoginRedirect,
} from "../utils/authActions";
import {
  subscribeToCartChanges,
  subscribeToCouponApplied,
} from "../events/localMeshEventBus";
import { calculateCheckoutTotals } from "../commands/placeCheckoutOrder";

/**
 * Renders checkout with remotes; summary refreshes from cart.changed while on this route.
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

  if (appState.cartItems.length === 0) {
    pageMount.innerHTML = `<section id="checkoutEmptyMount"></section>`;
    const checkoutEmptyMount = pageMount.querySelector("#checkoutEmptyMount");
    activeCleanupFunctions.push(modules.mountCheckoutEmpty(checkoutEmptyMount));
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

  let checkoutSummaryHandle = null;
  const refreshCheckoutSummary = () => {
    if (!checkoutSummaryHandle) {
      return;
    }
    checkoutSummaryHandle.update(calculateCheckoutTotals(appState));
  };

  activeCleanupFunctions.push(
    modules.mountCheckoutItems(checkoutItemsMount, {
      cartItems: appState.cartItems,
      productsById: appState.productsById,
      subscribeToCartChanges,
    }),
  );

  const initialTotals = calculateCheckoutTotals(appState);
  checkoutSummaryHandle = modules.mountCheckoutSummary(checkoutSummaryMount, {
    subtotal: initialTotals.subtotal,
    discountAmount: initialTotals.discountAmount,
  });
  activeCleanupFunctions.push(() => checkoutSummaryHandle.unmount());

  activeCleanupFunctions.push(modules.mountApplyCoupon(applyCouponMount));

  activeCleanupFunctions.push(
    subscribeToCartChanges(() => {
      refreshCheckoutSummary();
    }),
  );
  activeCleanupFunctions.push(
    subscribeToCouponApplied(() => {
      refreshCheckoutSummary();
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
