/**
 * Publishes and subscribes to catalog and cart contracts.
 * Role: Exposes cart and product-open operations over an injected transport.
 * Not in this file: Cart state mutation or the browser event-name map.
 * Key dependencies: src/catalogEventsContracts.js.
 * See also: src/index.js.
 */

import {
  CART_CHANGED_EVENT,
  CART_ITEM_ADD_REQUESTED_EVENT,
  CART_TOPIC,
  CATALOG_TOPIC,
  PRODUCT_OPEN_REQUESTED_EVENT,
  isValidCartAddRequest,
} from "./catalogEventsContracts.js";

/**
 * Creates catalog event operations bound to a transport.
 *
 * @param {{ publish: (message: { topic: string, event: string, payload?: object, scope: string }) => void, subscribe: (topic: string, event: string, callback: (message: { payload?: unknown }) => void) => () => void }} transport - Branch transport.
 * @returns {{ publishCartItemAddRequested: (payload: object) => void, subscribeToCartItemAddRequests: (listener: (payload: object) => void) => () => void, publishCartChanged: () => void, subscribeToCartChanges: (listener: () => void) => () => void, publishProductOpenRequested: (payload: { productId: string }) => void }} Catalog event operations.
 */
function createCatalogEvents({ publish, subscribe }) {
  function publishCartItemAddRequested(payload) {
    if (!isValidCartAddRequest(payload)) {
      return;
    }
    publish({
      topic: CART_TOPIC,
      event: CART_ITEM_ADD_REQUESTED_EVENT,
      payload,
      scope: "local",
    });
  }

  function subscribeToCartItemAddRequests(listener) {
    return subscribe(CART_TOPIC, CART_ITEM_ADD_REQUESTED_EVENT, (message) => {
      if (isValidCartAddRequest(message.payload)) {
        listener(message.payload);
      }
    });
  }

  function publishCartChanged() {
    publish({
      topic: CART_TOPIC,
      event: CART_CHANGED_EVENT,
      scope: "local",
    });
  }

  function subscribeToCartChanges(listener) {
    return subscribe(CART_TOPIC, CART_CHANGED_EVENT, () => {
      listener();
    });
  }

  function publishProductOpenRequested(payload) {
    publish({
      topic: CATALOG_TOPIC,
      event: PRODUCT_OPEN_REQUESTED_EVENT,
      payload,
      scope: "local",
    });
  }

  return {
    publishCartItemAddRequested,
    subscribeToCartItemAddRequests,
    publishCartChanged,
    subscribeToCartChanges,
    publishProductOpenRequested,
  };
}

export { createCatalogEvents };
