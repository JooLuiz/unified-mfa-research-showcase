/**
 * Module Federation entry for the product card MFE.
 * Role: Exposes mountProductCard; publishes catalog intents through the host Event Mesh singleton.
 * Not in this file: Card rendering (src/product-card-component.js) or mesh configuration.
 * Key dependencies: Vue createApp API; src/styles.css.
 * See also: src/product-card-component.js; MESH_IMPLEMENTATIONS/remote-intents.md.
 */

import { createApp } from "vue";
import { ProductCardComponent } from "./product-card-component";
import "./styles.css";

/**
 * Mounts a product card into a host container.
 *
 * @param {HTMLElement} containerElement - Host-owned mount element.
 * @param {{ product?: object, productId?: string, apiBaseUrl?: string, defaultQuantity?: number, actionLabel?: string, hideQuantity?: boolean, variant?: string }} props - Data props only; click/cart intents publish on mesh.
 * @returns {() => void} Cleanup that unmounts the Vue app.
 */
export function mountProductCard(containerElement, props) {
  const productCardApp = createApp(ProductCardComponent, {
    product: props.product,
    productId: props.productId,
    apiBaseUrl: props.apiBaseUrl,
    defaultQuantity: props.defaultQuantity,
    actionLabel: props.actionLabel,
    hideQuantity: props.hideQuantity,
    variant: props.variant,
  });
  productCardApp.mount(containerElement);

  return () => {
    productCardApp.unmount();
    containerElement.innerHTML = "";
  };
}
