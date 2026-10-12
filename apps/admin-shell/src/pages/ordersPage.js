/**
 * Renders the all-orders table route for the admin shell.
 * Role: Loads every order via the admin API and renders the table, kept live by
 *   prepending new rows and replacing a row when its status changes.
 * Not in this file: Auth guard (main.js), order mutations, or table markup
 *   (src/pages/ordersTableView.js).
 * Key dependencies: src/utils/fetchJson.js; src/notifications/notificationAdapter.js;
 *   src/events/adminLiveEvents.js; src/pages/ordersTableView.js.
 * See also: src/utils/renderActions.js (public barrel).
 */

import fetchJson from "../utils/fetchJson";
import { MOCK_API_BASE_URL } from "../utils/constants";
import { publishNotification } from "../notifications/notificationAdapter";
import { subscribeToAdminLiveEvents } from "../events/adminLiveEvents";
import { ORDER_CREATED_EVENT_TYPE } from "../events/adminLiveEventsContracts";
import { subscribeToAdminOrderStatusChanged } from "@shared/order-status-events";
import { navigate } from "../utils/navigate";
import { buildOrderRowMarkup, buildOrdersTableMarkup } from "./ordersTableView";

/**
 * Renders the orders table markup, or an empty-state message when there are no orders.
 *
 * @param {HTMLElement} tableMount - Container element for the table.
 * @param {object[]} orderRecords - Orders with their customer embedded.
 * @returns {void}
 * @sideEffects Replaces the table mount's contents.
 */
function renderOrdersTable(tableMount, orderRecords) {
  if (orderRecords.length === 0) {
    tableMount.innerHTML = `<p class="admin-empty">No orders found.</p>`;
    return;
  }
  tableMount.innerHTML = buildOrdersTableMarkup(orderRecords);
}

/**
 * Inserts a newly placed order as the first row of the orders table.
 *
 * @param {HTMLElement} tableMount - Container element for the table.
 * @param {object} orderRecord - Order with its customer embedded, as broadcast over SSE.
 * @returns {void}
 * @sideEffects Mutates the table mount's DOM.
 */
function prependOrderRow(tableMount, orderRecord) {
  const tableBody = tableMount.querySelector("tbody");
  if (!tableBody) {
    renderOrdersTable(tableMount, [orderRecord]);
    return;
  }
  tableBody.insertAdjacentHTML("afterbegin", buildOrderRowMarkup(orderRecord));
}

/**
 * Replaces one order row in place after its status changes.
 *
 * @param {HTMLElement} tableMount - Container element for the table.
 * @param {object} orderRecord - Order with its customer embedded and the new status.
 * @returns {void}
 * @sideEffects Replaces the matching row's markup. No-op when that order is not on screen.
 */
function updateOrderRow(tableMount, orderRecord) {
  const existingRow = tableMount.querySelector(
    `tr[data-order-id="${CSS.escape(orderRecord.id)}"]`,
  );
  if (!existingRow) {
    return;
  }
  existingRow.outerHTML = buildOrderRowMarkup(orderRecord);
}

/**
 * Renders the orders page with a table of all users' orders, kept live by prepending new
 * rows whenever an order is broadcast over SSE.
 *
 * @param {object} appState - Shell state holding the auth session.
 * @param {HTMLElement} pageMount - Route container element.
 * @param {Array<() => void>} activeCleanupFunctions - Cleanup registry for the current route.
 * @returns {Promise<void>}
 * @sideEffects Fetches admin orders, renders the table, and registers live-event subscriptions.
 */
async function renderOrdersPage(appState, pageMount, activeCleanupFunctions) {
  pageMount.innerHTML = `
    <section class="admin-table-page">
      <h2>All Orders</h2>
      <div id="ordersTableMount">
        <p class="admin-loading">Loading orders…</p>
      </div>
    </section>
  `;
  const tableMount = pageMount.querySelector("#ordersTableMount");

  let renderedOrders = [];
  try {
    const ordersPayload = await fetchJson(`${MOCK_API_BASE_URL}/admin/orders`, {
      headers: { Authorization: `Bearer ${appState.authToken}` },
    });
    renderedOrders = Array.isArray(ordersPayload.items) ? ordersPayload.items : [];
    renderOrdersTable(tableMount, renderedOrders);
  } catch (error) {
    tableMount.innerHTML = `<p class="admin-error">Unable to load orders.</p>`;
    publishNotification({
      type: "error",
      title: "Orders unavailable",
      message: "Unable to load all orders.",
    });
  }

  const unsubscribeFromLiveEvents = subscribeToAdminLiveEvents(({ type, data }) => {
    if (type === ORDER_CREATED_EVENT_TYPE) {
      renderedOrders = [data, ...renderedOrders];
      prependOrderRow(tableMount, data);
    }
  });
  const unsubscribeFromOrderStatus = subscribeToAdminOrderStatusChanged(({ orderId, status }) => {
    const matchingOrder = renderedOrders.find((orderRecord) => orderRecord.id === orderId);
    if (!matchingOrder) {
      return;
    }
    matchingOrder.status = status;
    updateOrderRow(tableMount, matchingOrder);
  });
  const handleRowClick = (clickEvent) => {
    const orderRow = clickEvent.target.closest("tr[data-order-id]");
    if (!orderRow || !tableMount.contains(orderRow)) {
      return;
    }
    const orderId = orderRow.dataset.orderId;
    if (!orderId) {
      return;
    }
    navigate(`/order-details/${encodeURIComponent(orderId)}`);
  };
  tableMount.addEventListener("click", handleRowClick);
  activeCleanupFunctions.push(unsubscribeFromLiveEvents);
  activeCleanupFunctions.push(unsubscribeFromOrderStatus);
  activeCleanupFunctions.push(() => {
    tableMount.removeEventListener("click", handleRowClick);
  });
}

export { renderOrdersPage };
