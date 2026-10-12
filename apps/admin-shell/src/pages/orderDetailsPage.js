/**
 * Renders one order for an admin, with status actions on the shared order details view.
 * Role: Guards nothing itself (main.js already requires an admin session) and mounts the
 *   order-details remote as the admin actor.
 * Not in this file: The header layout or status writes (order-details MFE).
 * Key dependencies: order-details remote; src/notifications/notificationAdapter.js.
 * See also: src/pages/ordersPage.js; src/main.js.
 */

import { navigate } from "../utils/navigate";
import { MOCK_API_BASE_URL } from "../utils/constants";
import { publishNotification } from "../notifications/notificationAdapter";

const ORDER_DETAILS_ROUTE_PREFIX = "/order-details/";

/**
 * Reads the order id from an admin order-details path.
 *
 * @param {string} pathName - Current pathname.
 * @returns {string} Decoded order id, or an empty string when the path is not an order details route.
 */
function readOrderIdFromPath(pathName) {
  if (!pathName.startsWith(ORDER_DETAILS_ROUTE_PREFIX)) {
    return "";
  }
  const orderIdSegment = pathName.slice(ORDER_DETAILS_ROUTE_PREFIX.length);
  if (!orderIdSegment || orderIdSegment.includes("/")) {
    return "";
  }
  try {
    return decodeURIComponent(orderIdSegment);
  } catch {
    return "";
  }
}

/**
 * Renders the admin order details page for the id in the URL.
 *
 * @param {object} appState - Shell state holding the admin auth token.
 * @param {HTMLElement} pageMount - Route container element.
 * @param {object} modules - Loaded remote module mount functions.
 * @param {Array<() => void>} activeCleanupFunctions - Cleanup registry for the current route.
 * @returns {Promise<void>}
 * @sideEffects Mounts the order details MFE and registers the back button.
 */
async function renderOrderDetailsPage(appState, pageMount, modules, activeCleanupFunctions) {
  const orderId = readOrderIdFromPath(window.location.pathname);
  pageMount.innerHTML = `
    <section class="admin-table-page">
      <div class="admin-order-details-header">
        <h2>Order Details</h2>
        <button id="backToOrdersButton" class="account-action-button" type="button">Back to orders</button>
      </div>
      <div id="orderDetailsMount"></div>
    </section>
  `;

  const backToOrdersButton = pageMount.querySelector("#backToOrdersButton");
  const handleBackToOrders = () => navigate("/orders");
  if (backToOrdersButton) {
    backToOrdersButton.addEventListener("click", handleBackToOrders);
    activeCleanupFunctions.push(() => {
      backToOrdersButton.removeEventListener("click", handleBackToOrders);
    });
  }

  if (!orderId) {
    const orderDetailsMount = pageMount.querySelector("#orderDetailsMount");
    orderDetailsMount.innerHTML = `<p class="admin-error">No order id was provided.</p>`;
    return;
  }

  const orderDetailsMount = pageMount.querySelector("#orderDetailsMount");
  activeCleanupFunctions.push(
    modules.mountOrderDetails(orderDetailsMount, {
      apiBaseUrl: MOCK_API_BASE_URL,
      actor: "admin",
      authToken: appState.authToken,
      onStatusRejected: () => {
        publishNotification({
          type: "error",
          title: "Status change rejected",
          message: "That status change is not allowed.",
        });
      },
    }),
  );
}

export { renderOrderDetailsPage, readOrderIdFromPath };
