/**
 * Cart changed and cart-add operations for the catalog event adapter.
 * Role: Publishes cart/changed and subscribes to cart add and cart changed on the caller's transport.
 * Not in this file: Product open, filters, promotions, or mesh configuration.
 * Key dependencies: src/catalogEventContracts.js.
 * See also: src/createCatalogEvents.js.
 */

import {
  CART_CHANGED_EVENT,
  CART_ITEM_ADD_REQUESTED_EVENT,
  CART_TOPIC,
  isValidCartAddRequest,
} from "./catalogEventContracts.js";

/**
 * Creates the cart operations shared by the catalog factory and its intent listeners.
 *
 * @param {{ publish: (input: object) => void, subscribe: (topic: string, event: string, callback: (message: object) => void) => () => void }} transport - Mesh client or recording transport. Both expose publish and subscribe.
 * @returns {{ publishCartChanged: (cartItems?: object[]) => void, subscribeToCartChanges: (listener: () => void) => () => void, subscribeToCartItemAddRequests: (listener: (payload: { productId: string, quantity: number }) => void) => () => void }} Cart publish and subscribe helpers.
 */
function createCatalogCartOperations(transport) {
  /**
   * Publishes a local cart/changed message. No argument omits the payload. An array is sent as items.
   *
   * @param {object[] | undefined} cartItems - Cart snapshot, or omitted when the caller only signals a change.
   * @returns {void}
   * @sideEffects Publishes a local cart.changed message.
   */
  function publishCartChanged(cartItems) {
    if (!Array.isArray(cartItems)) {
      transport.publish({
        topic: CART_TOPIC,
        event: CART_CHANGED_EVENT,
        scope: "local",
      });
      return;
    }

    transport.publish({
      topic: CART_TOPIC,
      event: CART_CHANGED_EVENT,
      payload: { items: cartItems },
      scope: "local",
    });
  }

  /**
   * Subscribes to cart/changed until the returned function runs.
   *
   * @param {() => void} listener - Called for each cart change.
   * @returns {() => void} Removes the subscription.
   * @sideEffects Registers a local cart subscription.
   */
  function subscribeToCartChanges(listener) {
    return transport.subscribe(CART_TOPIC, CART_CHANGED_EVENT, () => {
      listener();
    });
  }

  /**
   * Subscribes to valid cart item-add requests until the returned function runs.
   *
   * @param {(payload: { productId: string, quantity: number }) => void} listener - Called with each valid add request.
   * @returns {() => void} Removes the subscription.
   * @sideEffects Registers a local cart subscription. Invalid payloads are ignored.
   */
  function subscribeToCartItemAddRequests(listener) {
    return transport.subscribe(CART_TOPIC, CART_ITEM_ADD_REQUESTED_EVENT, (message) => {
      if (!isValidCartAddRequest(message.payload)) {
        return;
      }
      listener(message.payload);
    });
  }

  return {
    publishCartChanged,
    subscribeToCartChanges,
    subscribeToCartItemAddRequests,
  };
}

export { createCatalogCartOperations };
