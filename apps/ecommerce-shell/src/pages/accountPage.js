/**
 * Renders the account route with profile, address, and order history sections.
 * Role: Composes the account MFE mounts and the shell-owned "My Orders" list.
 * Not in this file: Account HTTP updates (src/commands/accountCommands.js) or order details (src/pages/orderPages.js).
 * Key dependencies: account/AccountProfile and account/AccountAddress remotes; mock data service GET /api/orders.
 * See also: src/utils/renderActions.js (public barrel).
 */

import { navigate } from "../utils/navigate";
import {
  isAuthenticated,
  rememberPostLoginRedirect,
} from "../utils/authActions";
import { MOCK_API_BASE_URL } from "../utils/constants";
import fetchJson from "../utils/fetchJson";
import { persistAccountUpdate } from "../commands/accountCommands";
import { requestCsvExport } from "../exports/requestCsvExport";
import { notify } from "../notifications/notificationBus";

/**
 * Renders the account page with profile, address, and order list sections.
 *
 * @param {object} appState - Shell state holding the authenticated session.
 * @param {HTMLElement} pageMount - Route container element.
 * @param {Array<() => void>} activeCleanupFunctions - Cleanup registry for the current route.
 * @returns {Promise<void>}
 */
async function renderAccountPage(appState, pageMount, activeCleanupFunctions) {
  if (!isAuthenticated(appState)) {
    rememberPostLoginRedirect("/account");
    navigate("/login");
    return;
  }

  pageMount.innerHTML = `
    <section class="account-page">
      <div class="account-page-header">
        <h2>My Account</h2>
        <div class="account-page-actions">
          <button id="continueShoppingButton" class="account-action-button" type="button">Continue shopping</button>
        </div>
      </div>
      <div id="accountProfileMount"></div>
      <div id="accountAddressMount"></div>
      <div id="accountOrdersMount" class="account-orders-section"></div>
    </section>
  `;

  const continueShoppingButton = pageMount.querySelector("#continueShoppingButton");
  if (continueShoppingButton) {
    continueShoppingButton.addEventListener("click", () => navigate("/products"));
  }

  const accountProfileMount = pageMount.querySelector("#accountProfileMount");
  const accountAddressMount = pageMount.querySelector("#accountAddressMount");
  const accountOrdersMount = pageMount.querySelector("#accountOrdersMount");

  const [accountProfileModule, accountAddressModule] = await Promise.all([
    import("account/AccountProfile"),
    import("account/AccountAddress"),
  ]);

  activeCleanupFunctions.push(
    accountProfileModule.mountAccountProfile(accountProfileMount, {
      user: appState.currentUser,
      onSaveProfile: (profilePayload) =>
        persistAccountUpdate(appState, profilePayload),
    }),
  );

  activeCleanupFunctions.push(
    accountAddressModule.mountAccountAddress(accountAddressMount, {
      address: appState.currentUser?.address,
      onSaveAddress: (addressPayload) =>
        persistAccountUpdate(appState, { address: addressPayload }),
    }),
  );

  await renderMyOrdersList(appState, accountOrdersMount, activeCleanupFunctions);
}

/**
 * Renders the authenticated user's order history rows inside the account page.
 *
 * @param {object} appState - Shell state holding the auth token.
 * @param {HTMLElement} ordersContainer - Section element that hosts the order list.
 * @param {Array<() => void>} activeCleanupFunctions - Cleanup registry for the current route.
 * @returns {Promise<void>}
 * @sideEffects Fetches orders over HTTP and registers row click cleanups.
 */
async function renderMyOrdersList(appState, ordersContainer, activeCleanupFunctions) {
  ordersContainer.innerHTML = `
    <section class="account-card">
      <header class="account-card-header">
        <div>
          <h2 class="account-card-title">My Orders</h2>
          <p class="account-card-subtitle">Loading your orders...</p>
        </div>
        <button id="exportOrdersButton" class="account-action-button" type="button">
          Export CSV
        </button>
      </header>
      <div id="myOrdersListMount"></div>
    </section>
  `;

  const myOrdersListMount = ordersContainer.querySelector("#myOrdersListMount");
  const subtitleElement = ordersContainer.querySelector(".account-card-subtitle");
  const exportOrdersButton = ordersContainer.querySelector("#exportOrdersButton");
  const handleOrdersExport = async () => {
    const exportResult = await requestCsvExport({
      endpointPath: "/exports/orders.csv",
      fileName: "my-orders.csv",
      authToken: appState.authToken,
    });
    notify(
      exportResult.ok
        ? {
            type: "success",
            title: "Orders exported",
            message: "Your order history has been downloaded as a CSV file.",
          }
        : {
            type: "error",
            title: "Order export failed",
            message: "Your order history could not be exported. Please try again.",
          },
    );
  };
  if (exportOrdersButton) {
    exportOrdersButton.addEventListener("click", handleOrdersExport);
    activeCleanupFunctions.push(() => {
      exportOrdersButton.removeEventListener("click", handleOrdersExport);
    });
  }

  let userOrders = [];
  try {
    const ordersResponse = await fetchJson(`${MOCK_API_BASE_URL}/orders`, {
      headers: {
        Authorization: `Bearer ${appState.authToken}`,
      },
    });
    userOrders = Array.isArray(ordersResponse?.items) ? ordersResponse.items : [];
  } catch (error) {
    console.warn("renderMyOrdersList - error");
    console.warn(error);
    if (subtitleElement) {
      subtitleElement.textContent = "Unable to load orders.";
    }
    return;
  }

  if (userOrders.length === 0) {
    if (subtitleElement) {
      subtitleElement.textContent = "You have not placed any orders yet.";
    }
    return;
  }

  if (subtitleElement) {
    subtitleElement.textContent = `${userOrders.length} order${userOrders.length === 1 ? "" : "s"} placed.`;
  }

  const sortedOrders = [...userOrders].sort(
    (firstOrder, secondOrder) =>
      new Date(secondOrder.placedAt).getTime() -
      new Date(firstOrder.placedAt).getTime(),
  );

  const orderRowClickHandlers = [];

  sortedOrders.forEach((order) => {
    const orderRow = document.createElement("button");
    orderRow.type = "button";
    orderRow.className = "my-orders-row";
    const itemCount = Array.isArray(order.items) ? order.items.length : 0;
    const placedAtLabel = order.placedAt
      ? new Date(order.placedAt).toLocaleString()
      : "-";
    const totalAmountLabel = `$${Number(order.totalAmount || 0).toFixed(2)}`;
    orderRow.innerHTML = `
      <span class="my-orders-row-id">${order.id}</span>
      <span class="my-orders-row-date">${placedAtLabel}</span>
      <span class="my-orders-row-items">${itemCount} item${itemCount === 1 ? "" : "s"}</span>
      <span class="my-orders-row-total">${totalAmountLabel}</span>
    `;
    const handleOrderClick = () => {
      const orderId = String(order.id || "").trim();
      if (!orderId) {
        return;
      }
      const encodedOrderId = encodeURIComponent(orderId);
      navigate(`/order-details/${encodedOrderId}`);
    };
    orderRow.addEventListener("click", handleOrderClick);
    orderRowClickHandlers.push({ orderRow, handleOrderClick });
    myOrdersListMount.appendChild(orderRow);
  });

  activeCleanupFunctions.push(() => {
    orderRowClickHandlers.forEach(({ orderRow, handleOrderClick }) => {
      orderRow.removeEventListener("click", handleOrderClick);
    });
  });
}

export { renderAccountPage };
