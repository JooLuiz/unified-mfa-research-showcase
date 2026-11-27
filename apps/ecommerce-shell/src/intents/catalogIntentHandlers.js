/**
 * Handles the shopper's catalog and cart requests from product, filter, banner, and checkout remotes.
 * Role: One place for the cart, filter, and navigation outcome of each catalog request. Pages call
 *   these from remote callback props, and a shell may also register them as intent listeners.
 * Not in this file: How a request reaches the shell, page-local UI refresh, or stock HTTP details.
 * Key dependencies: src/utils/cartActions.js; src/utils/PLPFilterActions.js; src/pages/promotionsPage.js.
 * See also: src/pages/catalogPages.js; src/pages/checkoutPage.js.
 */

import {
  STOCK_ISSUE_NOTIFICATION_MESSAGE,
  addCartItemWithStockCheck,
  setCartItemQuantityWithStockCheck,
} from "../utils/cartActions";
import { normalizePlpFilters, storePLPFilters } from "../utils/PLPFilterActions";
import { applyPromotionFilters } from "../pages/promotionsPage";
import { navigate as navigateInShell } from "../utils/navigate";
import { publishNotification } from "../notifications/notificationAdapter";
import { publishRenderRequested } from "../events/eventBus";

/**
 * Builds the product details path for one product.
 *
 * @param {string} productId - Catalog product id.
 * @returns {string} Shell path with an encoded productId query.
 */
function productDetailsPath(productId) {
  return `/product?productId=${encodeURIComponent(productId)}`;
}

/**
 * Creates the catalog request handlers for one shell state.
 *
 * @param {object} appState - Shell state holding cart items, products, and PLP filters.
 * @param {{ navigate?: (path: string) => void, notify?: (notification: object) => void, requestRender?: () => void }} [dependencies]
 *   - Navigation, toast, and re-render functions. They default to the shell's own.
 * @returns {{
 *   onProductOpenRequested: (payload: { productId: string }) => void,
 *   onFiltersApplyRequested: (filters: object) => void,
 *   onPromotionApplied: (payload: { filters?: object }) => void,
 *   onCartItemAddRequested: (cartItem: { productId: string, quantity?: number }) => Promise<object>,
 *   onCartItemUpdateRequested: (cartItem: { productId: string, quantity: number }) => Promise<object>,
 *   onCartItemRemoveRequested: (payload: { productId: string }) => Promise<object>,
 * }} Handlers. Cart handlers resolve to the stock outcome so a page can refresh its own UI.
 */
function createCatalogIntentHandlers(
  appState,
  {
    navigate = navigateInShell,
    notify = publishNotification,
    requestRender = publishRenderRequested,
  } = {},
) {
  function notifyStockIssue() {
    notify({
      type: "error",
      title: "Stock issue",
      message: STOCK_ISSUE_NOTIFICATION_MESSAGE,
    });
  }

  function productName(productId) {
    return appState.productsById?.[productId]?.name || "Item";
  }

  return {
    onProductOpenRequested({ productId }) {
      navigate(productDetailsPath(productId));
    },
    onFiltersApplyRequested(filters) {
      appState.plpFilters = normalizePlpFilters(filters);
      storePLPFilters(appState);
    },
    onPromotionApplied({ filters } = {}) {
      applyPromotionFilters(appState, filters);
    },
    async onCartItemAddRequested({ productId, quantity }) {
      const reservationResult = await addCartItemWithStockCheck(appState, productId, quantity);
      if (!reservationResult.ok) {
        notifyStockIssue();
        return reservationResult;
      }
      notify({
        type: "success",
        title: "Item added",
        message: `${productName(productId)} was added to your cart.`,
      });
      return reservationResult;
    },
    async onCartItemUpdateRequested({ productId, quantity }) {
      const stockCheckResult = await setCartItemQuantityWithStockCheck(appState, productId, quantity);
      if (!stockCheckResult.ok) {
        notifyStockIssue();
      }
      return stockCheckResult;
    },
    async onCartItemRemoveRequested({ productId }) {
      const removedName = productName(productId);
      const stockCheckResult = await setCartItemQuantityWithStockCheck(appState, productId, 0);
      if (!stockCheckResult.ok) {
        notifyStockIssue();
        return stockCheckResult;
      }
      notify({
        type: "success",
        title: "Item removed",
        message: `${removedName} was removed from your cart.`,
      });
      // Removing the last line re-renders so the empty-cart view replaces the item list.
      if (appState.cartItems.length === 0) {
        requestRender();
      }
      return stockCheckResult;
    },
  };
}

export { createCatalogIntentHandlers, productDetailsPath };
