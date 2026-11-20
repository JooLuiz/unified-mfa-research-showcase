/**
 * Shared response readers for server command descriptors.
 * Role: Turns a fetch Response into the { ok } outcome each command already returns.
 * Not in this file: URL selection or browser downloads.
 * Key dependencies: None.
 * See also: src/eventEndpoints.js.
 */

/**
 * Reads a JSON object from a failed response.
 *
 * @param {Response} response - HTTP response that was not ok.
 * @returns {Promise<object>} Parsed object, or an empty object when the body is not JSON.
 */
async function readErrorBody(response) {
  return response.json().catch(() => ({}));
}

/**
 * Reads a stock hold outcome.
 *
 * @param {Response} response - POST or PUT /stock/reservations response.
 * @returns {Promise<{ ok: true, quantity: number, available: number } | { ok: false, code: string }>}
 */
async function readStockOutcome(response) {
  if (!response.ok) {
    const errorBody = await readErrorBody(response);
    return { ok: false, code: errorBody.code || "request-failed" };
  }
  const acceptedBody = await response.json();
  return { ok: true, quantity: acceptedBody.quantity, available: acceptedBody.available };
}

/**
 * Reads an order-status write outcome.
 *
 * @param {Response} response - PUT /orders/:id/status response.
 * @returns {Promise<{ ok: true, order: object } | { ok: false, code: string }>}
 */
async function readOrderStatusOutcome(response) {
  if (!response.ok) {
    const errorBody = await readErrorBody(response);
    return { ok: false, code: errorBody.code || "request-failed" };
  }
  const order = await response.json();
  return { ok: true, order };
}

/**
 * Reads a post-like toggle outcome.
 *
 * @param {Response} response - POST /posts/:id/like response.
 * @returns {Promise<{ ok: true, liked: boolean, likes: number } | { ok: false, code: string }>}
 */
async function readLikeOutcome(response) {
  if (!response.ok) {
    const errorBody = await readErrorBody(response);
    return { ok: false, code: errorBody.code || "request-failed" };
  }
  const toggleResult = await response.json();
  return { ok: true, liked: toggleResult.liked, likes: toggleResult.likes };
}

/**
 * Reads a JSON list stored on `items`.
 *
 * @param {Response} response - Notification inbox response.
 * @returns {Promise<{ ok: true, items: object[] } | { ok: false, code: string }>}
 */
async function readItemListOutcome(response) {
  if (!response.ok) {
    return { ok: false, code: "request-failed" };
  }
  const data = await response.json();
  return { ok: true, items: Array.isArray(data.items) ? data.items : [] };
}

/**
 * Confirms a response is ok and parses JSON so an empty body still fails.
 *
 * @param {Response} response - Cart or order command response.
 * @returns {Promise<{ ok: true } | { ok: false }>}
 */
async function readAcceptedOutcome(response) {
  if (!response.ok) {
    return { ok: false };
  }
  await response.json();
  return { ok: true };
}

export {
  readAcceptedOutcome,
  readItemListOutcome,
  readLikeOutcome,
  readOrderStatusOutcome,
  readStockOutcome,
};
