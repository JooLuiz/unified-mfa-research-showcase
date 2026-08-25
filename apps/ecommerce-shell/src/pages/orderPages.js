/**
 * Renders the order details route for the ecommerce shell.
 * Role: Guards the route and mounts the order details MFE for the URL-encoded order id.
 * Not in this file: Order fetching or rendering internals (order-details MFE) or order history (src/pages/accountPage.js).
 * Key dependencies: order-details remote; src/utils/authActions.js.
 * See also: src/utils/renderActions.js (public barrel).
 */

import { navigate } from "../utils/navigate";
import {
  isAuthenticated,
  rememberPostLoginRedirect,
} from "../utils/authActions";
import { MOCK_API_BASE_URL } from "../utils/constants";

/**
 * Renders the order details page, redirecting to login when unauthenticated.
 *
 * @param {object} appState - Shell state holding the auth session.
 * @param {HTMLElement} pageMount - Route container element.
 * @param {object} modules - Loaded remote module mount functions.
 * @param {Array<() => void>} activeCleanupFunctions - Cleanup registry for the current route.
 * @returns {Promise<void>}
 */
async function renderOrderDetailsPage(appState, pageMount, modules, activeCleanupFunctions) {
  if (!isAuthenticated(appState)) {
    rememberPostLoginRedirect(window.location.pathname + window.location.search);
    navigate("/login");
    return;
  }

  pageMount.innerHTML = `
    <section class="order-details-page">
      <div class="order-details-page-header">
        <h2>Order Details</h2>
        <button id="backToAccountButton" class="account-action-button" type="button">Back to account</button>
      </div>
      <div id="orderDetailsMount"></div>
    </section>
  `;

  const backToAccountButton = pageMount.querySelector("#backToAccountButton");
  if (backToAccountButton) {
    backToAccountButton.addEventListener("click", () => navigate("/account"));
  }

  const orderDetailsMount = pageMount.querySelector("#orderDetailsMount");

  activeCleanupFunctions.push(
    modules.mountOrderDetails(orderDetailsMount, {
      apiBaseUrl: MOCK_API_BASE_URL,
    }),
  );
}

export { renderOrderDetailsPage };
