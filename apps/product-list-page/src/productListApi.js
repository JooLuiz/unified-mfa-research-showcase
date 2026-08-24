/**
 * HTTP access for the product list page.
 * Role: Owns category and product fetch requests, including abort support.
 * Not in this file: Query-string shape (src/productListFilters.js) or request state (src/hooks/useProductListData.js).
 * Key dependencies: Mock data service GET /categories and GET /products.
 * See also: src/hooks/useProductListData.js.
 */

import { buildProductsQueryString } from "./productListFilters";

/**
 * Fetches all product categories.
 *
 * @param {string} apiBaseUrl - Mock API base URL.
 * @param {AbortSignal} signal - Abort signal for the request.
 * @returns {Promise<Array>} Category list.
 * @throws {Error} When the response is not ok.
 */
async function fetchCategories(apiBaseUrl, signal) {
  const response = await fetch(`${apiBaseUrl}/categories`, { signal });
  if (!response.ok) {
    throw new Error(
      `fetchCategories - request failed: ${response.status} ${response.statusText}`,
    );
  }
  return response.json();
}

/**
 * Fetches products matching the given filters and sort.
 *
 * @param {string} apiBaseUrl - Mock API base URL.
 * @param {object} filters - Normalized filters.
 * @param {string} sortBy - Active sort key, or "" for none.
 * @param {AbortSignal} signal - Abort signal for the request.
 * @returns {Promise<{ total: number, items: Array }>} Paged product payload.
 * @throws {Error} When the response is not ok.
 */
async function fetchFilteredProducts(apiBaseUrl, filters, sortBy, signal) {
  const queryString = buildProductsQueryString(filters, sortBy);
  const requestUrl = queryString
    ? `${apiBaseUrl}/products?${queryString}`
    : `${apiBaseUrl}/products`;
  const response = await fetch(requestUrl, { signal });
  if (!response.ok) {
    throw new Error(
      `fetchFilteredProducts - request failed: ${response.status} ${response.statusText}`,
    );
  }
  return response.json();
}

export { fetchCategories, fetchFilteredProducts };
