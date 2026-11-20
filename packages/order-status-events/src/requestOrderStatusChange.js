/**
 * Sends one order status write through the injected transport.
 * Role: Asks the server to move one order to the given status.
 * Not in this file: The live status subscription (src/createOrderStatusSession.js).
 * Key dependencies: The caller supplies the transport.
 * See also: src/customerOrderStatusClient.js; src/adminOrderStatusClient.js.
 */

/**
 * Asks the server to move one order to the given status.
 *
 * @param {{ request: Function }} transport - Event interface.
 * @param {{ orderId: string, status: string, actor: "admin" | "customer" }} changeInput - Order id, next status, and the capacity the caller is acting in.
 * @returns {Promise<{ ok: true, order: object } | { ok: false, code: string }>} Updated order, or a rejection code.
 * @sideEffects Sends orders/status-change.
 */
function requestOrderStatusChange(transport, { orderId, status, actor }) {
  return transport.request({
    topic: "orders",
    event: "status-change",
    payload: { orderId, status, actor },
  });
}

export { requestOrderStatusChange };
