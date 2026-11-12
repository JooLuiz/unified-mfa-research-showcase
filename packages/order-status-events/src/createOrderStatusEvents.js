/**
 * Subscribes to order status changes over an injected transport.
 * Role: Delivers orders/status-changed payloads to one listener until unsubscribe.
 * Not in this file: The EventSource session (src/createOrderStatusSession.js) or the status write.
 * Key dependencies: src/orderStatusContracts.js. The caller supplies publish and subscribe.
 * See also: src/createOrderStatusSession.js; src/createOrderStatusSession.test.js.
 */

import { ORDERS_STATUS_CHANGED_EVENT, ORDERS_TOPIC } from "./orderStatusContracts.js";

/**
 * Creates order-status subscriptions bound to a transport.
 *
 * @param {{ publish: (message: { topic: string, event: string, payload?: object, scope?: string }) => void, subscribe: (topic: string, event: string, callback: (message: { payload?: unknown }) => void) => () => void }} transport - Branch transport.
 * @returns {{ subscribeToOrderStatusChanged: (listener: (statusEvent: { orderId: string, status: string }) => void) => () => void }} Order-status operations.
 * @sideEffects Subscribes to orders/status-changed.
 */
function createOrderStatusEvents({ subscribe }) {
  /**
   * Subscribes to order status changes.
   *
   * @param {(statusEvent: { orderId: string, status: string }) => void} listener - Called with each status payload.
   * @returns {() => void} Function that removes the subscription.
   * @sideEffects Registers a transport subscription.
   */
  function subscribeToOrderStatusChanged(listener) {
    return subscribe(ORDERS_TOPIC, ORDERS_STATUS_CHANGED_EVENT, (message) => {
      listener(message.payload);
    });
  }

  return { subscribeToOrderStatusChanged };
}

export { createOrderStatusEvents, ORDERS_STATUS_CHANGED_EVENT, ORDERS_TOPIC };
