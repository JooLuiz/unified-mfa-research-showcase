/**
 * Subscribes to live stock counts over an injected transport.
 * Role: Delivers stock/changed updates, and lets one caller watch a single product id.
 * Not in this file: The EventSource connection (src/createStockWatchClient.js) or reservation HTTP commands.
 * Key dependencies: src/stockEventsContracts.js. The caller supplies publish and subscribe.
 * See also: src/createStockWatchClient.js; src/createStockWatchClient.test.js.
 */

import { STOCK_CHANGED_EVENT, STOCK_TOPIC } from "./stockEventsContracts.js";

/**
 * Creates stock watch subscriptions bound to a transport.
 *
 * @param {{ publish: (message: { topic: string, event: string, payload?: object, scope?: string }) => void, subscribe: (topic: string, event: string, callback: (message: { payload?: { productId?: string, available?: number } }) => void) => () => void }} transport - Branch transport.
 * @returns {{ subscribeToStockChanged: (listener: (update: { productId: string, available: number }) => void) => () => void, watchProduct: (productId: string, onAvailableChange: (available: number) => void) => () => void }} Stock watch operations.
 * @sideEffects Subscribes to stock/changed.
 */
function createStockWatchEvents({ subscribe }) {
  /**
   * Subscribes to every stock change.
   *
   * @param {(update: { productId: string, available: number }) => void} listener - Called with each stock payload.
   * @returns {() => void} Function that removes the subscription.
   * @sideEffects Registers a transport subscription.
   */
  function subscribeToStockChanged(listener) {
    return subscribe(STOCK_TOPIC, STOCK_CHANGED_EVENT, (message) => {
      listener(message.payload);
    });
  }

  /**
   * Subscribes to availability for one product id.
   *
   * @param {string} productId - Catalog product id to watch.
   * @param {(available: number) => void} onAvailableChange - Called with that product's available count.
   * @returns {() => void} Function that removes the subscription.
   * @sideEffects Registers a transport subscription. Ignores updates for other product ids.
   */
  function watchProduct(productId, onAvailableChange) {
    return subscribe(STOCK_TOPIC, STOCK_CHANGED_EVENT, (message) => {
      const stockUpdate = message.payload;
      if (!stockUpdate || stockUpdate.productId !== productId) {
        return;
      }
      onAvailableChange(stockUpdate.available);
    });
  }

  return { subscribeToStockChanged, watchProduct };
}

export { createStockWatchEvents, STOCK_CHANGED_EVENT, STOCK_TOPIC };
