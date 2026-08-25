/**
 * Renders the catalog routes: product list (PLP) and product details (PDP).
 * Role: Wires shell state and navigation into the product list and product details MFEs.
 * Not in this file: Filter persistence shape (src/utils/PLPFilterActions.js) or cart storage (src/utils/cartActions.js).
 * Key dependencies: product-list-page, product-details-page, product-showcase, and product-card remotes.
 * See also: src/utils/renderActions.js (public barrel).
 */

import { navigate } from "../utils/navigate";
import { dispatchAddToCartEvent } from "../utils/cartActions";
import { storePLPFilters, normalizePlpFilters } from "../utils/PLPFilterActions";
import { MOCK_API_BASE_URL } from "../utils/constants";

/**
 * Renders the product list page and persists filter changes back to shell state.
 *
 * @param {object} appState - Shell state holding plpFilters and plpSortBy.
 * @param {HTMLElement} pageMount - Route container element.
 * @param {object} modules - Loaded remote module mount functions.
 * @param {Array<() => void>} activeCleanupFunctions - Cleanup registry for the current route.
 * @returns {Promise<void>}
 */
async function renderProductListPage(appState, pageMount, modules, activeCleanupFunctions) {
  pageMount.innerHTML = `<section id="plpMount"></section>`;
  const plpMount = pageMount.querySelector("#plpMount");

  activeCleanupFunctions.push(
    modules.mountProductList(plpMount, {
      apiBaseUrl: MOCK_API_BASE_URL,
      initialFilters: appState.plpFilters,
      initialSort: appState.plpSortBy,
      onFiltersChange: (nextFilters) => {
        appState.plpFilters = normalizePlpFilters(nextFilters);
        storePLPFilters(appState);
      },
      onProductClick: (productId) => navigate(`/product?productId=${productId}`),
      onAddToCart: dispatchAddToCartEvent,
    }),
  );
}

/**
 * Renders the product details page, delegating similar products to the showcase MFE.
 *
 * @param {object} appState - Shell state (unused directly; kept for interface consistency).
 * @param {HTMLElement} pageMount - Route container element.
 * @param {object} modules - Loaded remote module mount functions.
 * @param {Array<() => void>} activeCleanupFunctions - Cleanup registry for the current route.
 * @returns {Promise<void>}
 */
async function renderProductDetailsPage(appState, pageMount, modules, activeCleanupFunctions) {
  pageMount.innerHTML = `<section id="pdpMount"></section>`;
  const pdpMount = pageMount.querySelector("#pdpMount");

  activeCleanupFunctions.push(
    modules.mountProductDetails(pdpMount, {
      apiBaseUrl: MOCK_API_BASE_URL,
      onAddToCart: dispatchAddToCartEvent,
      mountSimilarProducts: (containerElement, similarProductsProps) =>
        modules.mountProductShowcase(containerElement, {
          title: similarProductsProps.title,
          productIds: similarProductsProps.productIds,
          apiBaseUrl: similarProductsProps.apiBaseUrl,
          mountProductCard: modules.mountProductCard,
          onProductClick: (nextProductId) =>
            navigate(`/product?productId=${nextProductId}`),
          onAddToCart: dispatchAddToCartEvent,
        }),
    }),
  );
}

export { renderProductListPage, renderProductDetailsPage };
