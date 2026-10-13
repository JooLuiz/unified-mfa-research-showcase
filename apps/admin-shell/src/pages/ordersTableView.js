/**
 * Builds the markup for the admin orders table.
 * Role: Pure HTML-building helpers shared by the initial orders fetch, the live
 *   order-row prepend, and the in-place status update.
 * Not in this file: Fetching, auth, or live-event subscription (src/pages/ordersPage.js).
 * Key dependencies: @shared/order-status-events for the status label.
 * See also: src/pages/ordersPage.js.
 */

import { formatOrderStatus } from "@shared/order-status-events";

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
 * Builds the markup for a single order row.
 *
 * @param {object} orderRecord - Order with its customer embedded (as returned by GET /admin/orders).
 * @returns {string} `<tr>` markup for the orders table body.
 */
function buildOrderRowMarkup(orderRecord) {
  const customerName =
    orderRecord.customer?.fullName ||
    orderRecord.customer?.username ||
    "Unknown customer";
  const itemCount = (orderRecord.items || []).reduce(
    (accumulator, orderItem) => accumulator + (orderItem.quantity || 0),
    0,
  );
  return `
    <tr class="admin-order-row" data-order-id="${orderRecord.id}">
      <td>${orderRecord.id}</td>
      <td>${customerName}</td>
      <td>${formatDate(orderRecord.placedAt)}</td>
      <td>${itemCount}</td>
      <td class="admin-cell-number">${formatCurrency(
        getOrderTotalAmount(orderRecord),
      )}</td>
      <td>${formatOrderStatus(orderRecord.status)}</td>
    </tr>
  `;
}

/**
 * Builds the full orders table markup, including header and body rows.
 *
 * @param {object[]} orderRecords - Orders with their customer embedded.
 * @returns {string} `<table>` markup.
 */
function buildOrdersTableMarkup(orderRecords) {
  const tableRows = orderRecords.map(buildOrderRowMarkup).join("");
  return `
    <table class="admin-table">
      <thead>
        <tr>
          <th>Order</th>
          <th>Customer</th>
          <th>Placed At</th>
          <th>Items</th>
          <th>Total</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
  `;
}

export { buildOrderRowMarkup, buildOrdersTableMarkup };
