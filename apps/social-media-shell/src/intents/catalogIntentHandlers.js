/**
 * Sends a social member to the ecommerce shell for a product or promotion they picked.
 * Role: One place for the ecommerce URL each catalog request opens. Pages call these from remote
 *   callback props, and a shell may also register them as intent listeners.
 * Not in this file: How a request reaches the shell, or the ecommerce routes themselves.
 * Key dependencies: src/utils/constants.js ECOMMERCE_SHELL_BASE_URL.
 * See also: src/pages/feedPage.js; src/pages/postsPage.js.
 */

import { ECOMMERCE_SHELL_BASE_URL } from "../utils/constants";

/**
 * Builds the ecommerce product details URL for one product.
 *
 * @param {string} productId - Catalog product id.
 * @returns {string} Absolute ecommerce /product URL.
 */
function buildEcommerceProductUrl(productId) {
  return `${ECOMMERCE_SHELL_BASE_URL}/product?productId=${encodeURIComponent(productId)}`;
}

/**
 * Builds the ecommerce product list URL for a promotion's filters.
 *
 * @param {{ searchQuery?: string, minPrice?: string, maxPrice?: string, categoryIds?: string[] } | null | undefined} filters
 *   - Promotion filters. Missing values are left out of the query.
 * @returns {string} Absolute ecommerce /products URL with an optional query.
 */
function buildEcommerceProductsUrl(filters) {
  const queryParams = new URLSearchParams();
  if (filters?.searchQuery) {
    queryParams.set("searchQuery", filters.searchQuery);
  }
  if (filters?.minPrice) {
    queryParams.set("minPrice", filters.minPrice);
  }
  if (filters?.maxPrice) {
    queryParams.set("maxPrice", filters.maxPrice);
  }
  if (Array.isArray(filters?.categoryIds) && filters.categoryIds.length > 0) {
    queryParams.set("categoryIds", filters.categoryIds.join(","));
  }
  const querySuffix = queryParams.toString();
  return querySuffix
    ? `${ECOMMERCE_SHELL_BASE_URL}/products?${querySuffix}`
    : `${ECOMMERCE_SHELL_BASE_URL}/products`;
}

/**
 * Opens a URL in the current tab.
 *
 * @param {string} url - Absolute URL.
 * @returns {void}
 * @sideEffects Assigns window.location.
 */
function assignWindowLocation(url) {
  window.location.assign(url);
}

/**
 * Creates the catalog request handlers for the social shell.
 *
 * @param {{ assignLocation?: (url: string) => void }} [dependencies] - Page-leaving function.
 * @returns {{
 *   onProductOpenRequested: (payload: { productId: string }) => void,
 *   onCartItemAddRequested: (payload: { productId: string }) => void,
 *   onPromotionApplied: (payload: { filters?: object }) => void,
 * }} Handlers. Adding to the cart opens the product, because the social shell has no cart.
 */
function createCatalogIntentHandlers({ assignLocation = assignWindowLocation } = {}) {
  return {
    onProductOpenRequested({ productId }) {
      assignLocation(buildEcommerceProductUrl(productId));
    },
    onCartItemAddRequested({ productId }) {
      assignLocation(buildEcommerceProductUrl(productId));
    },
    onPromotionApplied({ filters } = {}) {
      assignLocation(buildEcommerceProductsUrl(filters));
    },
  };
}

export { buildEcommerceProductUrl, buildEcommerceProductsUrl, createCatalogIntentHandlers };
