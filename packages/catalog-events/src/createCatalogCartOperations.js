/**
 * Cart changed and cart-add operations for the catalog event adapter.
 * Role: Publishes cart/changed and subscribes to cart add and cart changed on the caller's transport.
 * Not in this file: Cart-add publish, product open, or the browser event-name map.
 * Key dependencies: src/catalogEventsContracts.js.
 * See also: src/createCatalogEvents.js.
 */

import {
  CART_CHANGED_EVENT,
  CART_ITEM_ADD_REQUESTED_EVENT,
  CART_TOPIC,
  isValidCartAddRequest,
} from "./catalogEventsContracts.js";

/**
 * Creates the cart operations shared by the catalog factory.
 *
 * @param {{ publish: (message: { topic: string, event: string, payload?: object, scope: string }) => void, subscribe: (topic: string, event: string, callback: (message: { payload?: unknown }) => void) => () => void }} transport - Branch transport.
 * @returns {{ publishCartChanged: () => void, subscribeToCartChanges: (listener: () => void) => () => void, subscribeToCartItemAddRequests: (listener: (payload: object) => void) => () => void }} Cart publish and subscribe helpers.
 * @note publishCartChanged always includes payload: {} so every transport receives a record.
 */
function createCatalogCartOperations({ publish, subscribe }) {
  function publishCartChanged() {
    publish({
      topic: CART_TOPIC,
      event: CART_CHANGED_EVENT,
      payload: {},
      scope: "local",
    });
  }

  function subscribeToCartChanges(listener) {
    return subscribe(CART_TOPIC, CART_CHANGED_EVENT, () => {
      listener();
    });
  }

  function subscribeToCartItemAddRequests(listener) {
    return subscribe(CART_TOPIC, CART_ITEM_ADD_REQUESTED_EVENT, (message) => {
      if (isValidCartAddRequest(message.payload)) {
        listener(message.payload);
      }
    });
  }

  return {
    publishCartChanged,
    subscribeToCartChanges,
    subscribeToCartItemAddRequests,
  };
}

export { createCatalogCartOperations };
