/**
 * Shared reply readers for server command descriptors.
 * Role: Turns a gateway reply payload, or an HTTP Response for the few HTTP descriptors, into the
 *   { ok } outcome each command already returns.
 * Not in this file: Topic selection, reply waiting, or browser downloads.
 * Key dependencies: None.
 * See also: src/eventEndpoints.js; src/openEventConnection.js.
 *   On main these readers take a fetch Response; this branch reads the gateway reply payload.
 */

/**
 * @param {{ code?: string, quantity?: number, available?: number }} payload - Stock reply.
 * @returns {{ ok: boolean, code?: string, quantity?: number, available?: number }}
 */
function readStockOutcome(payload) {
  return payload.code
    ? { ok: false, code: payload.code }
    : { ok: true, quantity: payload.quantity, available: payload.available };
}

/**
 * @param {{ order?: object, code?: string }} payload - Order status reply.
 * @returns {{ ok: boolean, order?: object, code?: string }}
 */
function readOrderStatusOutcome(payload) {
  return payload.order
    ? { ok: true, order: payload.order }
    : { ok: false, code: payload.code || "request-failed" };
}

/**
 * @param {{ code?: string, liked?: boolean, likes?: number }} payload - Like toggle reply.
 * @returns {{ ok: boolean, code?: string, liked?: boolean, likes?: number }}
 */
function readLikeOutcome(payload) {
  return payload.code
    ? { ok: false, code: payload.code }
    : { ok: true, liked: payload.liked, likes: payload.likes };
}

/**
 * @param {{ items?: object[], code?: string }} payload - Reply carrying a list of rows.
 * @returns {{ ok: boolean, items?: object[], code?: string }}
 */
function readItemListOutcome(payload) {
  return payload.items
    ? { ok: true, items: payload.items }
    : { ok: false, code: payload.code || "request-failed" };
}

/**
 * @param {{ code?: string }} payload - Reply that only signals acceptance.
 * @returns {{ ok: boolean, code?: string }}
 */
function readAcceptedOutcome(payload) {
  return payload.code ? { ok: false, code: payload.code } : { ok: true };
}

/**
 * Reads a JSON body and stores it under one key. Used by HTTP descriptors (method, no publishTopic).
 *
 * @param {Response} response - Write response whose body is the saved resource.
 * @param {string} key - Outcome property that receives the parsed body.
 * @returns {Promise<{ ok: true, [key: string]: unknown } | { ok: false, code: string }>}
 */
async function readJsonOutcome(response, key) {
  if (response.status === 401) {
    return { ok: false, code: "unauthorized" };
  }
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    return { ok: false, code: errorBody.code || "request-failed" };
  }
  const resource = await response.json();
  return { ok: true, [key]: resource };
}

export {
  readAcceptedOutcome,
  readItemListOutcome,
  readJsonOutcome,
  readLikeOutcome,
  readOrderStatusOutcome,
  readStockOutcome,
};
