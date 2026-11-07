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
 * Copy for a failed order fetch. A 403 stays on this page; the shell owns login redirects.
 *
 * @param {Error & { status?: number }} loadError - Failure from fetchOrderById, with the HTTP status attached.
 * @returns {string} Message for the empty order-details state.
 */
function orderLoadFailureMessage(loadError) {
  if (loadError?.status === 403) {
    return "This order belongs to another account.";
  }

  if (loadError?.status === 404) {
    return "Order not found.";
  }

  return "Unable to load order details.";
}

/**
 * Order details component.
 * Props: order (object, optional pre-loaded order), apiBaseUrl (string), actor ("customer" or "admin"),
 *   authToken (string, optional override), getAuthToken (function, live token getter),
 *   onStatusRejected (function, called for either actor's rejected status write).
 * Renders: loading, missing-id, forbidden (403), not-found (404), generic error, or the full order details section.
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
    actor: {
      type: String,
      default: "customer",
    },
    authToken: {
      type: String,
      default: "",
    },
    getAuthToken: {
      type: Function,
      default: null,
    },
    onStatusRejected: {
      type: Function,
      default: null,
    },
  },
  setup(props) {
    const {
      orderData,
      isLoading,
      loadError,
      isMissingOrderId,
      actor,
      applyStatusAction,
    } = useOrderDetails(props);

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
          orderLoadFailureMessage(loadError.value),
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
        renderOrderHeader(order, { actor, onStatusAction: applyStatusAction }),
        renderOrderMeta(order, orderItems.length),
        orderItems.length > 0 ? renderItemsTable(orderItems) : null,
        renderTotalsSection(order),
        renderShippingAddress(order.shippingAddress),
      ]);
    };
  },
};

export { OrderDetailsComponent };
