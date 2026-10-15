/**
 * Sends one order status write over the Event Mesh gateway and waits for the server's reply.
 * Role: Publishes orders/status-change-requested and resolves with the updated order from
 *   orders/status-accepted, or a rejection code from orders/status-rejected.
 * Not in this file: The status-changed broadcast subscription (src/createOrderStatusWatchSession.js).
 * Key dependencies: event-mesh/mesh.
 * See also: apps/mock-data-service/src/event-mesh/orderStatusHandler.js;
 *   apps/ecommerce-shell/src/commands/cartCommands.js (same publish-and-wait shape).
 */

import mesh from "event-mesh/mesh";
import {
  ORDERS_TOPIC,
  ORDERS_STATUS_ACCEPTED_EVENT,
  ORDERS_STATUS_CHANGE_REQUESTED_EVENT,
  ORDERS_STATUS_REJECTED_EVENT,
} from "./orderStatusContracts.js";

const STATUS_CHANGE_TIMEOUT_MS = 15000;
const MESH_CONNECT_TIMEOUT_MS = 5000;

/** @type {{ requestId: string, resolve: (outcome: { ok: boolean, order?: object, code?: string }) => void } | null} */
let pendingChangeWaiter = null;
let changeListenersStarted = false;

function resolveChangeWaiter(outcome) {
  if (!pendingChangeWaiter) {
    return;
  }
  const resolveWaiter = pendingChangeWaiter.resolve;
  pendingChangeWaiter = null;
  resolveWaiter(outcome);
}

/**
 * Subscribes once to the accepted and rejected replies.
 *
 * @returns {void}
 * @sideEffects Registers mesh subscribers for the life of the module. The gateway targets each
 *   reply at the requesting client, so no further filtering by client is needed here; the
 *   requestId check only disambiguates two in-flight requests from this same tab.
 */
function ensureStatusChangeListeners() {
  if (changeListenersStarted) {
    return;
  }
  changeListenersStarted = true;
  mesh.subscribe(ORDERS_TOPIC, ORDERS_STATUS_ACCEPTED_EVENT, (message) => {
    if (!pendingChangeWaiter || message.payload?.requestId !== pendingChangeWaiter.requestId) {
      return;
    }
    resolveChangeWaiter({ ok: true, order: message.payload.order });
  });
  mesh.subscribe(ORDERS_TOPIC, ORDERS_STATUS_REJECTED_EVENT, (message) => {
    if (!pendingChangeWaiter || message.payload?.requestId !== pendingChangeWaiter.requestId) {
      return;
    }
    resolveChangeWaiter({ ok: false, code: message.payload?.code || "request-failed" });
  });
}

function waitForStatusChange(requestId) {
  return new Promise((resolve) => {
    const timeoutId = window.setTimeout(() => {
      if (pendingChangeWaiter?.requestId === requestId) {
        pendingChangeWaiter = null;
      }
      resolve({ ok: false, code: "timeout" });
    }, STATUS_CHANGE_TIMEOUT_MS);

    pendingChangeWaiter = {
      requestId,
      resolve: (outcome) => {
        window.clearTimeout(timeoutId);
        resolve(outcome);
      },
    };
  });
}

/**
 * Asks the server to move one order to the given status over the gateway.
 *
 * @param {{ orderId: string, status: string, actor: "admin" | "customer", apiBaseUrl?: string, authToken?: string }} changeInput - Order id, the next status, and the capacity the caller is acting in.
 *   `apiBaseUrl`/`authToken` are accepted and ignored: the open mesh connection already carries the authenticated credential.
 * @returns {Promise<{ ok: true, order: object } | { ok: false, code: string }>} Updated order, or a rejection code.
 * @sideEffects Publishes orders/status-change-requested and waits for the targeted reply.
 */
async function requestOrderStatusChange({ orderId, status, actor }) {
  const requestId = `order-status-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  try {
    ensureStatusChangeListeners();
    await mesh.whenConnected({ timeoutMs: MESH_CONNECT_TIMEOUT_MS });

    const changeOutcomePromise = waitForStatusChange(requestId);
    mesh.publish({
      topic: ORDERS_TOPIC,
      event: ORDERS_STATUS_CHANGE_REQUESTED_EVENT,
      payload: { requestId, orderId, nextStatus: status, actor },
      scope: "distributed",
    });

    return await changeOutcomePromise;
  } catch (error) {
    console.warn("requestOrderStatusChange - error");
    console.warn(error);
    return { ok: false, code: "network-error" };
  }
}

export { requestOrderStatusChange };
