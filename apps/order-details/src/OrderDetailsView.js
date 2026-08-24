/**
 * Root view component for the order details MFE.
 * Role: Selects the loading/missing/error/loaded state and composes the order fragments.
 * Not in this file: Order loading (src/useOrderDetails.js), fragment markup (src/order-details-renderers.js),
 *   or mounting (src/order-details.js).
 * Key dependencies: Vue h() rendering API.
 * See also: src/order-details.js.
 */

import { h } from "vue";
import { useOrderDetails } from "./useOrderDetails";
import {
  renderItemsTable,
  renderOrderHeader,
  renderOrderMeta,
  renderShippingAddress,
  renderTotalsSection,
} from "./order-details-renderers";

/**
 * Order details component.
 * Props: order (object, optional pre-loaded order) and apiBaseUrl (string, mock API base URL).
 * Renders: loading, missing-id, error, not-found, or the full order details section.
 */
const OrderDetailsComponent = {
  props: {
    order: {
      type: Object,
      default: null,
    },
    apiBaseUrl: {
      type: String,
      default: "",
    },
  },
  setup(props) {
    const { orderData, isLoading, loadError, isMissingOrderId } =
      useOrderDetails(props);

    return () => {
      if (isLoading.value && !orderData.value) {
        return h(
          "section",
          { class: "order-details-empty" },
          "Loading order...",
        );
      }

      if (isMissingOrderId.value) {
        return h(
          "section",
          { class: "order-details-empty" },
          "No order id was provided.",
        );
      }

      if (loadError.value) {
        return h(
          "section",
          { class: "order-details-empty" },
          "Unable to load order details.",
        );
      }

      const order = orderData.value;
      if (!order) {
        return h(
          "section",
          { class: "order-details-empty" },
          "Order not found.",
        );
      }

      const orderItems = Array.isArray(order.items) ? order.items : [];

      return h("section", { class: "order-details-shell" }, [
        renderOrderHeader(order),
        renderOrderMeta(order, orderItems.length),
        orderItems.length > 0 ? renderItemsTable(orderItems) : null,
        renderTotalsSection(order),
        renderShippingAddress(order.shippingAddress),
      ]);
    };
  },
};

export { OrderDetailsComponent };
