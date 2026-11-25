/**
 * Publishes and subscribes to catalog and cart contracts.
 * Role: Exposes cart and product-open operations over an injected transport, dropping invalid
 *   cart-add payloads and blank product-open ids.
 * Not in this file: Cart state mutation, the browser event-name map, or the cart-changed and
 *   cart-add subscribe helpers (src/createCatalogCartOperations.js).
 * Key dependencies: src/catalogEventsContracts.js; src/createCatalogCartOperations.js.
 * See also: src/index.js.
 */

import {
  CART_ITEM_ADD_REQUESTED_EVENT,
  CART_TOPIC,
  CATALOG_TOPIC,
  PRODUCT_OPEN_REQUESTED_EVENT,
  isValidCartAddRequest,
} from "./catalogEventsContracts.js";
import { createCatalogCartOperations } from "./createCatalogCartOperations.js";

/**
 * Creates catalog event operations bound to a transport.
 *
 * @param {{ publish: (message: { topic: string, event: string, payload?: object, scope: string }) => void, subscribe: (topic: string, event: string, callback: (message: { payload?: unknown }) => void) => () => void }} transport - Branch transport.
 * @returns {{ publishCartItemAddRequested: (payload: object) => void, subscribeToCartItemAddRequests: (listener: (payload: object) => void) => () => void, publishCartChanged: () => void, subscribeToCartChanges: (listener: () => void) => () => void, publishProductOpenRequested: (productOpenRequest: string | { productId: string }) => void }} Catalog event operations.
 * @note publishCartChanged always includes payload: {} so every transport receives a record.
 */
function createCatalogEvents(transport) {
  const cartOperations = createCatalogCartOperations(transport);

  function publishCartItemAddRequested(payload) {
    if (!isValidCartAddRequest(payload)) {
      return;
    }
    transport.publish({
      topic: CART_TOPIC,
      event: CART_ITEM_ADD_REQUESTED_EVENT,
      payload,
      scope: "local",
    });
  }

  /**
   * Publishes a request to open product details for a product id.
   *
   * @param {string | { productId: string }} productOpenRequest - Product id, or an object carrying productId.
   * @returns {void}
   * @sideEffects Publishes { productId } only; drops a missing or blank id.
   */
  function publishProductOpenRequested(productOpenRequest) {
    const productId = typeof productOpenRequest === "string"
      ? productOpenRequest
      : productOpenRequest?.productId;
    if (typeof productId !== "string" || productId.trim() === "") {
      return;
    }
    transport.publish({
      topic: CATALOG_TOPIC,
      event: PRODUCT_OPEN_REQUESTED_EVENT,
      payload: { productId },
      scope: "local",
    });
  }

  return {
    publishCartItemAddRequested,
    ...cartOperations,
    publishProductOpenRequested,
  };
}

export { createCatalogEvents };
