/**
 * Renders the promotions route and owns the promotion-to-catalog filter handoff.
 * Role: Mounts one promotional banner per configured banner and converts banner filters into PLP navigation.
 * Not in this file: Banner internals (banners MFE) or product list rendering (product-list-page MFE).
 * Key dependencies: src/utils/PLPFilterActions.js, src/utils/navigate.js.
 * See also: src/pages/homePage.js (reuses applyPromotionFilters).
 */

import { navigate } from "../utils/navigate";
import { storePLPFilters, normalizePlpFilters } from "../utils/PLPFilterActions";
import { MOCK_API_BASE_URL } from "../utils/constants";

/**
 * Stores banner-driven filters and navigates to the product list.
 *
 * @param {object} appState - Shell state holding plpFilters.
 * @param {object} promotionFilters - Raw filter values carried by the banner.
 * @returns {void}
 * @sideEffects Persists PLP filters to localStorage and navigates.
 */
function applyPromotionFilters(appState, promotionFilters) {
  appState.plpFilters = normalizePlpFilters(promotionFilters || {});
  storePLPFilters(appState);
  navigate("/products");
}

/**
 * Renders the promotions page with one banner mount per configured banner.
 *
 * @param {object} appState - Shell state holding banners.
 * @param {HTMLElement} pageMount - Route container element.
 * @param {object} modules - Loaded remote module mount functions.
 * @param {Array<() => void>} activeCleanupFunctions - Cleanup registry for the current route.
 * @returns {Promise<void>}
 */
async function renderPromotionsPage(appState, pageMount, modules, activeCleanupFunctions) {
  pageMount.innerHTML = `<section id="promotionsMount" class="page-content"></section>`;
  const promotionsMount = pageMount.querySelector("#promotionsMount");

  appState.banners.forEach((banner) => {
    const bannerContainer = document.createElement("div");
    promotionsMount.appendChild(bannerContainer);
    activeCleanupFunctions.push(
      modules.mountPromotionalBanner(bannerContainer, {
        bannerId: banner.id,
        apiBaseUrl: MOCK_API_BASE_URL,
        onApplyPromotion: (promotionFilters) =>
          applyPromotionFilters(appState, promotionFilters),
      }),
    );
  });
}

export { renderPromotionsPage, applyPromotionFilters };
