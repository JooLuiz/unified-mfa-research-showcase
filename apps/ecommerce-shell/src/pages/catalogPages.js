/**
 * Renders the catalog routes: product list (PLP) and product details (PDP).
 * Role: Wires shell state into the product list and product details MFEs; filter and product intents come from mesh.
 * Not in this file: Filter persistence shape (src/utils/PLPFilterActions.js) or cart storage (src/utils/cartActions.js).
 * Key dependencies: product-list-page, product-details-page, product-showcase, and product-card remotes.
 * See also: src/utils/renderActions.js (public barrel); MESH_IMPLEMENTATIONS/remote-intents.md.
 */

import { MOCK_API_BASE_URL } from "../utils/constants";

/**
 * Renders the product list page; filter apply intents are handled by persistent mesh listeners in main.js.
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
      mountSimilarProducts: (containerElement, similarProductsProps) =>
        modules.mountProductShowcase(containerElement, {
          title: similarProductsProps.title,
          productIds: similarProductsProps.productIds,
          apiBaseUrl: similarProductsProps.apiBaseUrl,
          mountProductCard: modules.mountProductCard,
        }),
    }),
  );
}

export { renderProductListPage, renderProductDetailsPage };
