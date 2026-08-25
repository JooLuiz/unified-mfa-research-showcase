/**
 * Module Federation entry for the order details MFE.
 * Role: Exposes mountOrderDetails to host shells; view logic lives in OrderDetailsView and useOrderDetails.
 * Not in this file: Order loading, rendering, or formatting.
 * Key dependencies: Vue createApp API; src/styles.css.
 * See also: src/OrderDetailsView.js.
 */

import { createApp } from "vue";
import "./styles.css";
import { OrderDetailsComponent } from "./OrderDetailsView";

/**
 * Mounts the order details view into a host container.
 *
 * @param {HTMLElement} containerElement - Host-owned mount element.
 * @param {{ order?: object, apiBaseUrl?: string }} props - Optional pre-loaded order and mock API base URL.
 * @returns {() => void} Cleanup that unmounts the Vue app.
 */
export function mountOrderDetails(containerElement, props) {
  const orderDetailsApp = createApp(OrderDetailsComponent, {
    order: props.order,
    apiBaseUrl: props.apiBaseUrl,
  });
  orderDetailsApp.mount(containerElement);

  return () => {
    orderDetailsApp.unmount();
    containerElement.innerHTML = "";
  };
}
