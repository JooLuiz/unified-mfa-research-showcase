/**
 * Sends one order status write to the mock API.
 * Role: PUT /orders/:orderId/status for both the customer cancellation request and admin actions.
 * Not in this file: The SSE connection (src/createOrderStatusStreamSession.js).
 * Key dependencies: fetch.
 * See also: apps/mock-data-service/src/routes/orderStatusRoutes.js.
 */

/**
 * Asks the server to move one order to the given status.
 *
 * @param {{ apiBaseUrl: string, authToken: string, orderId: string, status: string }} changeInput - API base, bearer token, order id, and the next status.
 * @returns {Promise<{ ok: true, order: object } | { ok: false, code: string }>} Updated order, or a rejection code.
 * @sideEffects Performs the HTTP status write.
 */
async function requestOrderStatusChange({ apiBaseUrl, authToken, orderId, status }) {
  try {
    const response = await fetch(
      `${apiBaseUrl}/orders/${encodeURIComponent(orderId)}/status`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ status }),
      },
    );
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      return { ok: false, code: errorBody.code || "request-failed" };
    }
    const order = await response.json();
    return { ok: true, order };
  } catch (error) {
    console.warn("requestOrderStatusChange - error");
    console.warn(error);
    return { ok: false, code: "network-error" };
  }
}

export { requestOrderStatusChange };
