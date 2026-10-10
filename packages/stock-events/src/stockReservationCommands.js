/**
 * Reserve and release stock holds over Event Mesh, waiting for the server's accept or reject.
 * Role: Publishes stock/reserve or stock/release with a correlating requestId, then resolves
 *   once the matching stock/accepted or stock/rejected reply arrives, or a request times out.
 * Not in this file: Live availability display (src/createStockWatchClient.js) or guest session
 *   id management (src/guestStockSession.js).
 * Key dependencies: An Event Mesh client supplied by the caller; src/stockEventsContracts.js.
 * See also: apps/mock-data-service/src/event-mesh/stockHandler.js.
 *   On main this module sends HTTP requests; this branch publishes through mesh and waits for
 *   a targeted reply instead of an HTTP response.
 */

import {
  STOCK_ACCEPTED_EVENT,
  STOCK_RELEASE_EVENT,
  STOCK_RESERVE_EVENT,
  STOCK_REJECTED_EVENT,
  STOCK_TOPIC,
} from "./stockEventsContracts.js";

const STOCK_REQUEST_TIMEOUT_MS = 10_000;
const MESH_CONNECT_TIMEOUT_MS = 5000;

function generateStockRequestId(event) {
  return `stock-${event}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Publishes one stock/reserve or stock/release message and waits for the targeted reply.
 *
 * @param {{ publish: (input: object) => void, subscribe: (topic: string, event: string, callback: (message: object) => void) => () => void }} mesh - Configured mesh client for the owning shell.
 * @param {string} event - STOCK_RESERVE_EVENT or STOCK_RELEASE_EVENT.
 * @param {{ productId: string, quantity: number, sessionId?: string | null }} requestInput - Product, quantity, and the guest session id when there is no signed-in credential.
 * @returns {Promise<{ ok: true, quantity: number, available: number } | { ok: false, code: string }>} Server outcome, or a timeout rejection.
 */
function sendStockRequest(mesh, event, { productId, quantity, sessionId }) {
  return new Promise((resolve) => {
    const requestId = generateStockRequestId(event);
    let unsubscribeFromAccepted = null;
    let unsubscribeFromRejected = null;
    let timeoutId = null;

    function settle(outcome) {
      window.clearTimeout(timeoutId);
      if (unsubscribeFromAccepted) {
        unsubscribeFromAccepted();
      }
      if (unsubscribeFromRejected) {
        unsubscribeFromRejected();
      }
      resolve(outcome);
    }

    timeoutId = window.setTimeout(() => {
      settle({ ok: false, code: "network-error" });
    }, STOCK_REQUEST_TIMEOUT_MS);

    unsubscribeFromAccepted = mesh.subscribe(STOCK_TOPIC, STOCK_ACCEPTED_EVENT, (message) => {
      if (message.payload?.requestId !== requestId) {
        return;
      }
      settle({ ok: true, quantity: message.payload.quantity, available: message.payload.available });
    });
    unsubscribeFromRejected = mesh.subscribe(STOCK_TOPIC, STOCK_REJECTED_EVENT, (message) => {
      if (message.payload?.requestId !== requestId) {
        return;
      }
      settle({ ok: false, code: message.payload.code });
    });

    mesh
      .whenConnected({ timeoutMs: MESH_CONNECT_TIMEOUT_MS })
      .then(() => {
        mesh.publish({
          topic: STOCK_TOPIC,
          event,
          payload: {
            requestId,
            productId,
            quantity,
            ...(sessionId ? { sessionId } : {}),
          },
          scope: "distributed",
        });
      })
      .catch(() => {
        settle({ ok: false, code: "network-error" });
      });
  });
}

/**
 * Adds a quantity to the caller's hold for one product. Rejects the whole request when it is
 * greater than what's available.
 *
 * @param {{ mesh: object, sessionId?: string | null, productId: string, quantity: number }} reserveInput - Mesh client, guest session id (omit when signed in), product, and quantity to add.
 * @returns {Promise<{ ok: true, quantity: number, available: number } | { ok: false, code: string }>} Server outcome.
 */
async function reserveStockQuantity({ mesh, sessionId, productId, quantity }) {
  return sendStockRequest(mesh, STOCK_RESERVE_EVENT, { productId, quantity, sessionId });
}

/**
 * Sets the caller's hold for one product to an absolute quantity. 0 removes the line.
 *
 * @param {{ mesh: object, sessionId?: string | null, productId: string, quantity: number }} setInput - Mesh client, guest session id (omit when signed in), product, and the next absolute quantity.
 * @returns {Promise<{ ok: true, quantity: number, available: number } | { ok: false, code: string }>} Server outcome.
 */
async function setStockQuantity({ mesh, sessionId, productId, quantity }) {
  return sendStockRequest(mesh, STOCK_RELEASE_EVENT, { productId, quantity, sessionId });
}

export { reserveStockQuantity, setStockQuantity };
