/**
 * One order-status subscription per tab.
 * Role: Starts and stops the orders/status-changed subscription and fans payloads out to listeners.
 * Not in this file: The ticket URL (the shell endpoint map) or the status write.
 * Key dependencies: src/orderStatusContracts.js. The caller supplies the transport.
 * See also: src/customerOrderStatusClient.js; src/adminOrderStatusClient.js.
 */

import { ORDERS_STATUS_CHANGED_EVENT, ORDERS_TOPIC } from "./orderStatusContracts.js";

/**
 * Creates a tab-scoped order-status subscription. Call start once per signed-in session.
 *
 * @returns {{ start: (transport: { subscribe: Function }) => void, stop: () => void, subscribe: (listener: (event: { orderId: string, status: string }) => void) => () => void }} Stream controls.
 */
function createOrderStatusStreamSession() {
  /** @type {Set<(event: { orderId: string, status: string }) => void>} */
  const listeners = new Set();
  let unsubscribeFromTransport = null;

  /**
   * Opens the tab's order-status subscription when none is open.
   *
   * @param {{ subscribe: Function }} transport - Event interface whose shell map selects the customer or admin stream.
   * @returns {void}
   * @sideEffects Subscribes to orders/status-changed.
   */
  function start(transport) {
    if (unsubscribeFromTransport) {
      return;
    }
    unsubscribeFromTransport = transport.subscribe(
      ORDERS_TOPIC,
      ORDERS_STATUS_CHANGED_EVENT,
      (message) => {
        const statusEvent = message.payload || {};
        listeners.forEach((listener) => listener(statusEvent));
      },
    );
  }

  /**
   * Closes the subscription.
   *
   * @returns {void}
   * @sideEffects Unsubscribes from the transport.
   */
  function stop() {
    if (unsubscribeFromTransport) {
      unsubscribeFromTransport();
      unsubscribeFromTransport = null;
    }
  }

  /**
   * Registers a listener. Safe to call before start.
   *
   * @param {(event: { orderId: string, status: string }) => void} listener - Called with each pushed status.
   * @returns {() => void} Unsubscribe function.
   * @sideEffects Registers the listener.
   */
  function subscribe(listener) {
    listeners.add(listener);
    return function unsubscribeFromOrderStatus() {
      listeners.delete(listener);
    };
  }

  return { start, stop, subscribe };
}

export { createOrderStatusStreamSession };
