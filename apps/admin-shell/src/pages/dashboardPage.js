/**
 * Renders the admin dashboard route for the admin shell.
 * Role: Loads all orders and posts and renders summary cards with totals.
 * Not in this file: Table rendering (orders/posts pages) or auth guard (main.js).
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

/**
 * Returns a safe numeric total from an order record.
 */
function getOrderTotalAmount(orderRecord) {
  return Number.isFinite(orderRecord.totalAmount)
    ? orderRecord.totalAmount
    : 0;
}

/**
 * Renders the dashboard page with summary cards for all orders and posts.
 *
 * @param {object} appState - Shell state holding the auth session.
 * @param {HTMLElement} pageMount - Route container element.
 * @returns {Promise<void>}
 * @sideEffects Fetches admin data and renders summary cards; on failure shows an inline error and a toast.
 */
async function renderDashboardPage(appState, pageMount) {
  pageMount.innerHTML = `
    <section class="admin-dashboard">
      <h2>Admin Dashboard</h2>
      <div id="dashboardCards" class="admin-dashboard-cards">
        <p class="admin-loading">Loading summary…</p>
      </div>
    </section>
  `;
  const cardsMount = pageMount.querySelector("#dashboardCards");

  try {
    const requestOptions = {
      headers: { Authorization: `Bearer ${appState.authToken}` },
    };
    const [ordersPayload, postsPayload] = await Promise.all([
      fetchJson(`${MOCK_API_BASE_URL}/admin/orders`, requestOptions),
      fetchJson(`${MOCK_API_BASE_URL}/admin/posts`, requestOptions),
    ]);

    const totalRevenue = ordersPayload.items.reduce(
      (accumulator, orderRecord) =>
        accumulator + getOrderTotalAmount(orderRecord),
      0,
    );

    cardsMount.innerHTML = `
      <article class="admin-summary-card">
        <h3>Total Orders</h3>
        <p class="admin-summary-value">${ordersPayload.total}</p>
      </article>
      <article class="admin-summary-card">
        <h3>Total Posts</h3>
        <p class="admin-summary-value">${postsPayload.total}</p>
      </article>
      <article class="admin-summary-card">
        <h3>Total Revenue</h3>
        <p class="admin-summary-value">${formatCurrency(totalRevenue)}</p>
      </article>
    `;
  } catch (error) {
    cardsMount.innerHTML = `
      <p class="admin-error">Unable to load dashboard data.</p>
    `;
    notify({
      type: "error",
      title: "Dashboard unavailable",
      message: "Unable to load orders and posts summary.",
    });
  }
}

export { renderDashboardPage };
