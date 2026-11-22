/**
 * One order-status subscription per tab.
 * Role: Starts and stops the orders/status-changed subscription, announces orders/watching, and fans payloads out to listeners.
 * Not in this file: The ticket URL (the shell endpoint map) or the status write.
 * Key dependencies: src/orderStatusContracts.js. The caller supplies the transport.
 * See also: src/customerOrderStatusClient.js; src/adminOrderStatusClient.js.
 */

import {
  ORDERS_STATUS_CHANGED_EVENT,
  ORDERS_TOPIC,
  ORDERS_WATCHING_EVENT,
} from "./orderStatusContracts.js";

const MESH_CONNECT_TIMEOUT_MS = 5000;

/**
 * Registers this tab for order-status pushes once the socket is open.
 *
 * @param {{ publish?: Function, whenConnected?: Function }} transport - Event interface. A subscribe-only fake is ignored.
 * @returns {void}
 * @sideEffects Publishes orders/watching. A connect timeout is swallowed.
 */
function publishOrdersWatching(transport) {
  if (!openTransport(transport)) {
    return;
  }
  transport.publish({
    topic: ORDERS_TOPIC,
    event: ORDERS_WATCHING_EVENT,
    payload: {},
    scope: "distributed",
  });
}

/**
 * Starts the socket for a transport that can publish. A subscribe-only fake is skipped.
 *
 * @param {{ publish?: Function, whenConnected?: Function }} transport - Event interface.
 * @returns {boolean} True when the caller should publish.
 * @sideEffects Calls whenConnected. A closed client or a connect timeout does not throw.
 */
function openTransport(transport) {
  if (typeof transport.publish !== "function" || typeof transport.whenConnected !== "function") {
    return false;
  }
  try {
    const connected = transport.whenConnected({ timeoutMs: MESH_CONNECT_TIMEOUT_MS });
    if (connected && typeof connected.catch === "function") {
      connected.catch(() => {
        // The gateway only pushes status changes to registered clients.
      });
    }
  } catch {
    return false;
  }
  return true;
}

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
   * @sideEffects Subscribes to orders/status-changed and publishes orders/watching.
   */
  function start(transport) {
    if (unsubscribeFromTransport) {
      return;
    }
    publishOrdersWatching(transport);
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
