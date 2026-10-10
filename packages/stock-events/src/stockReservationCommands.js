/**
 * Low-level HTTP calls for reserving and releasing stock holds.
 * Role: POST/PUT /stock/reservations, called directly by the ecommerce shell when it gates a
 *   cart edit. Not involved in the shared watch stream.
 * Not in this file: Live availability display (src/createStockWatchClient.js) or guest session
 *   id management (src/guestStockSession.js).
 * Key dependencies: fetch; src/stockEventsContracts.js.
 * See also: apps/mock-data-service/src/routes/stockRoutes.js.
 */

import {
  STOCK_RESERVATIONS_PATH,
  STOCK_SESSION_HEADER_NAME,
} from "./stockEventsContracts.js";

function buildStockRequestHeaders({ authToken, guestSessionId }) {
  const headers = { "Content-Type": "application/json" };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  } else if (guestSessionId) {
    headers[STOCK_SESSION_HEADER_NAME] = guestSessionId;
  }
  return headers;
}

async function sendStockRequest({ apiBaseUrl, method, authToken, guestSessionId, productId, quantity }) {
  try {
    const response = await fetch(`${apiBaseUrl}${STOCK_RESERVATIONS_PATH}`, {
      method,
      headers: buildStockRequestHeaders({ authToken, guestSessionId }),
      body: JSON.stringify({ productId, quantity }),
    });
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      return { ok: false, code: errorBody.code || "request-failed" };
    }
    const acceptedBody = await response.json();
    return { ok: true, quantity: acceptedBody.quantity, available: acceptedBody.available };
  } catch (error) {
    console.warn("sendStockRequest - error");
    console.warn(error);
    return { ok: false, code: "network-error" };
  }
}

/**
 * Adds a quantity to the caller's hold for one product. Rejects the whole request when it is
 * greater than what's available.
 *
 * @param {{ apiBaseUrl: string, authToken?: string | null, guestSessionId?: string | null, productId: string, quantity: number }} reserveInput - API base, caller identity (exactly one of authToken/guestSessionId), product, and quantity to add.
 * @returns {Promise<{ ok: true, quantity: number, available: number } | { ok: false, code: string }>} Server outcome.
 */
async function reserveStockQuantity({ apiBaseUrl, authToken, guestSessionId, productId, quantity }) {
  return sendStockRequest({ apiBaseUrl, method: "POST", authToken, guestSessionId, productId, quantity });
}

/**
 * Sets the caller's hold for one product to an absolute quantity. 0 removes the line.
 *
 * @param {{ apiBaseUrl: string, authToken?: string | null, guestSessionId?: string | null, productId: string, quantity: number }} setInput - API base, caller identity, product, and the next absolute quantity.
 * @returns {Promise<{ ok: true, quantity: number, available: number } | { ok: false, code: string }>} Server outcome.
 */
async function setStockQuantity({ apiBaseUrl, authToken, guestSessionId, productId, quantity }) {
  return sendStockRequest({ apiBaseUrl, method: "PUT", authToken, guestSessionId, productId, quantity });
}

export { reserveStockQuantity, setStockQuantity };
