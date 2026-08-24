/**
 * VNode render helpers for the order details MFE.
 * Role: Owns the header, meta list, items table, totals, and shipping-address fragments of the order view.
 * Not in this file: Order state (src/useOrderDetails.js) or top-level state selection (src/OrderDetailsView.js).
 * Key dependencies: Vue h() rendering API.
 * See also: src/OrderDetailsView.js.
 */

import { h } from "vue";
import {
  buildAddressLines,
  formatCurrencyValue,
  formatDateValue,
} from "./order-details-utils";

/**
 * Renders the order header with id and placement date.
 *
 * @param {object} order - Order record.
 * @returns {import("vue").VNode} Header fragment.
 */
function renderOrderHeader(order) {
  return h("header", { class: "order-details-header" }, [
    h("h2", { class: "order-details-title" }, `Order ${order.id}`),
    h(
      "span",
      { class: "order-details-status" },
      `Placed on ${formatDateValue(order.placedAt)}`,
    ),
  ]);
}

/**
 * Renders the order meta list: item count, subtotal, coupon, and total.
 *
 * @param {object} order - Order record.
 * @param {number} itemCount - Number of line items.
 * @returns {import("vue").VNode} Meta list fragment.
 */
function renderOrderMeta(order, itemCount) {
  const couponSummary = order.appliedCoupon?.code
    ? `${order.appliedCoupon.code} (-${formatCurrencyValue(order.discountAmount)})`
    : "None";

  return h("ul", { class: "order-details-meta" }, [
    h("li", null, [
      h("span", { class: "order-details-meta-label" }, "Items"),
      h(
        "span",
        { class: "order-details-meta-value" },
        String(itemCount),
      ),
    ]),
    h("li", null, [
      h("span", { class: "order-details-meta-label" }, "Subtotal"),
      h(
        "span",
        { class: "order-details-meta-value" },
        formatCurrencyValue(order.subtotal),
      ),
    ]),
    h("li", null, [
      h("span", { class: "order-details-meta-label" }, "Coupon"),
      h(
        "span",
        { class: "order-details-meta-value" },
        couponSummary,
      ),
    ]),
    h("li", null, [
      h("span", { class: "order-details-meta-label" }, "Total"),
      h(
        "span",
        { class: "order-details-meta-value" },
        formatCurrencyValue(order.totalAmount),
      ),
    ]),
  ]);
}

/**
 * Renders the line items table.
 *
 * @param {Array} items - Order line items.
 * @returns {import("vue").VNode} Items table fragment.
 */
function renderItemsTable(items) {
  return h("table", { class: "order-details-items-table" }, [
    h("thead", null, [
      h("tr", null, [
        h("th", null, "Product"),
        h("th", null, "Quantity"),
        h("th", null, "Unit price"),
        h("th", null, "Subtotal"),
      ]),
    ]),
    h(
      "tbody",
      null,
      items.map((orderItem) =>
        h("tr", { key: orderItem.productId }, [
          h("td", null, orderItem.name || orderItem.productId),
          h("td", null, String(orderItem.quantity)),
          h("td", null, formatCurrencyValue(orderItem.unitPrice)),
          h(
            "td",
            null,
            formatCurrencyValue(
              Number(orderItem.unitPrice) * Number(orderItem.quantity),
            ),
          ),
        ]),
      ),
    ),
  ]);
}

/**
 * Renders the totals section, including the discount row when present.
 *
 * @param {object} order - Order record.
 * @returns {import("vue").VNode} Totals fragment.
 */
function renderTotalsSection(order) {
  const discountAmount = Number(order.discountAmount);
  const hasDiscount = Number.isFinite(discountAmount) && discountAmount > 0;

  return h("section", { class: "order-details-totals" }, [
    h("div", { class: "order-details-totals-row" }, [
      h("span", null, "Subtotal:"),
      h("span", null, formatCurrencyValue(order.subtotal)),
    ]),
    hasDiscount
      ? h("div", { class: "order-details-totals-row" }, [
          h("span", null, "Discount:"),
          h("span", null, `-${formatCurrencyValue(discountAmount)}`),
        ])
      : null,
    h(
      "div",
      { class: "order-details-totals-row is-total" },
      [
        h("span", null, "Total:"),
        h("span", null, formatCurrencyValue(order.totalAmount)),
      ],
    ),
  ]);
}

/**
 * Renders the shipping address section, or null when no address is available.
 *
 * @param {object} shippingAddress - Address record from the order.
 * @returns {import("vue").VNode | null} Shipping fragment or null.
 */
function renderShippingAddress(shippingAddress) {
  const addressLines = buildAddressLines(shippingAddress);
  if (addressLines.length === 0) {
    return null;
  }
  return h("section", { class: "order-details-shipping" }, [
    h("h3", null, "Shipping address"),
    h(
      "address",
      null,
      addressLines.map((addressLine, lineIndex) => [
        addressLine,
        lineIndex < addressLines.length - 1 ? h("br") : null,
      ]),
    ),
  ]);
}

export {
  renderOrderHeader,
  renderOrderMeta,
  renderItemsTable,
  renderTotalsSection,
  renderShippingAddress,
};
