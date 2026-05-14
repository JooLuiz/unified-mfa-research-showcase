import { createApp, h } from "vue";
import "./styles.css";

function formatCurrencyValue(amount) {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount)) {
    return "$0.00";
  }
  return `$${numericAmount.toFixed(2)}`;
}

function formatDateValue(isoDateString) {
  if (!isoDateString) {
    return "-";
  }
  const dateValue = new Date(isoDateString);
  if (Number.isNaN(dateValue.getTime())) {
    return isoDateString;
  }
  return dateValue.toLocaleString();
}

function buildAddressLines(shippingAddress) {
  if (!shippingAddress || typeof shippingAddress !== "object") {
    return [];
  }
  const cityRegionLine = [shippingAddress.city, shippingAddress.state]
    .filter(Boolean)
    .join(", ");
  const postalCountryLine = [shippingAddress.postalCode, shippingAddress.country]
    .filter(Boolean)
    .join(" - ");
  return [shippingAddress.street, cityRegionLine, postalCountryLine].filter(
    Boolean,
  );
}

const OrderDetailsComponent = {
  props: {
    order: {
      type: Object,
      default: () => null,
    },
  },
  setup(props) {
    const renderItemsTable = (items) =>
      h("table", { class: "order-details-items-table" }, [
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

    const renderShippingAddress = (shippingAddress) => {
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
    };

    return () => {
      const order = props.order;
      if (!order) {
        return h(
          "section",
          { class: "order-details-empty" },
          "Order not found.",
        );
      }

      const orderItems = Array.isArray(order.items) ? order.items : [];
      const couponSummary = order.appliedCoupon?.code
        ? `${order.appliedCoupon.code} (-${formatCurrencyValue(order.discountAmount)})`
        : "None";

      const discountAmount = Number(order.discountAmount);
      const hasDiscount = Number.isFinite(discountAmount) && discountAmount > 0;

      return h("section", { class: "order-details-shell" }, [
        h("header", { class: "order-details-header" }, [
          h("h2", { class: "order-details-title" }, `Order ${order.id}`),
          h(
            "span",
            { class: "order-details-status" },
            `Placed on ${formatDateValue(order.placedAt)}`,
          ),
        ]),
        h("ul", { class: "order-details-meta" }, [
          h("li", null, [
            h("span", { class: "order-details-meta-label" }, "Items"),
            h(
              "span",
              { class: "order-details-meta-value" },
              String(orderItems.length),
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
        ]),
        orderItems.length > 0 ? renderItemsTable(orderItems) : null,
        h("section", { class: "order-details-totals" }, [
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
        ]),
        renderShippingAddress(order.shippingAddress),
      ]);
    };
  },
};

export function mountOrderDetails(containerElement, props) {
  const orderDetailsApp = createApp(OrderDetailsComponent, {
    order: props.order,
  });
  orderDetailsApp.mount(containerElement);

  return () => {
    orderDetailsApp.unmount();
    containerElement.innerHTML = "";
  };
}
