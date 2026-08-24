/**
 * Renders the all-orders table route for the admin shell.
 * Role: Loads every order via the admin API and renders a read-only table.
 * Not in this file: Auth guard (main.js) or order mutations.
 * Key dependencies: src/utils/fetchJson.js; src/notifications/notificationBus.js.
 * See also: src/utils/renderActions.js (public barrel).
 */

import fetchJson from "../utils/fetchJson";
import { MOCK_API_BASE_URL } from "../utils/constants";
import { notify } from "../notifications/notificationBus";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function formatDate(isoDate) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(isoDate));
}

/**
 * Returns a safe numeric total from an order record.
 */
function getOrderTotalAmount(orderRecord) {
  return Number.isFinite(orderRecord.totalAmount)
    ? orderRecord.totalAmount
    : 0;
}

/**
 * Renders the orders page with a table of all users' orders.
 *
 * @param {object} appState - Shell state holding the auth session.
 * @param {HTMLElement} pageMount - Route container element.
 * @returns {Promise<void>}
 * @sideEffects Fetches admin orders and renders the table; on failure shows an inline error and a toast.
 */
async function renderOrdersPage(appState, pageMount) {
  pageMount.innerHTML = `
    <section class="admin-table-page">
      <h2>All Orders</h2>
      <div id="ordersTableMount">
        <p class="admin-loading">Loading orders…</p>
      </div>
    </section>
  `;
  const tableMount = pageMount.querySelector("#ordersTableMount");

  try {
    const ordersPayload = await fetchJson(`${MOCK_API_BASE_URL}/admin/orders`, {
      headers: { Authorization: `Bearer ${appState.authToken}` },
    });

    if (ordersPayload.items.length === 0) {
      tableMount.innerHTML = `<p class="admin-empty">No orders found.</p>`;
      return;
    }

    const tableRows = ordersPayload.items
      .map((orderRecord) => {
        const customerName =
          orderRecord.customer?.fullName ||
          orderRecord.customer?.username ||
          "Unknown customer";
        const itemCount = (orderRecord.items || []).reduce(
          (accumulator, orderItem) => accumulator + (orderItem.quantity || 0),
          0,
        );
        return `
          <tr>
            <td>${orderRecord.id}</td>
            <td>${customerName}</td>
            <td>${formatDate(orderRecord.placedAt)}</td>
            <td>${itemCount}</td>
            <td class="admin-cell-number">${formatCurrency(
              getOrderTotalAmount(orderRecord),
            )}</td>
          </tr>
        `;
      })
      .join("");

    tableMount.innerHTML = `
      <table class="admin-table">
        <thead>
          <tr>
            <th>Order</th>
            <th>Customer</th>
            <th>Placed At</th>
            <th>Items</th>
            <th>Total</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    `;
  } catch (error) {
    tableMount.innerHTML = `<p class="admin-error">Unable to load orders.</p>`;
    notify({
      type: "error",
      title: "Orders unavailable",
      message: "Unable to load all orders.",
    });
  }
}

export { renderOrdersPage };
