/**
 * Pushes order status changes to the customer who owns the order and to every admin tab.
 * Role: Owns the in-memory set of open order-status SSE responses.
 * Not in this file: Transition rules (src/domain/orderStatus.js) or ticket checks
 *   (src/routes/orderStatusRoutes.js).
 * Key dependencies: None (pure Node response writes).
 * See also: src/routes/orderStatusRoutes.js. On the mesh branch this module publishes through
 *   the gateway; this branch writes Server-Sent Events.
 */

const ORDER_STATUS_CHANGED_EVENT_NAME = "orders.status-changed";

/**
 * Formats one orders.status-changed Server-Sent Event.
 *
 * @param {string} orderId - Order whose status changed.
 * @param {string} status - Status now stored on the order.
 * @returns {string} SSE frame.
 */
function serializeStatusChanged(orderId, status) {
  return `event: ${ORDER_STATUS_CHANGED_EVENT_NAME}\ndata: ${JSON.stringify({ orderId, status })}\n\n`;
}

/**
 * Creates the order-status SSE registry.
 *
 * @returns {{ registerCustomer: (userId: string, response: import("express").Response) => void, registerAdmin: (response: import("express").Response) => void, broadcastStatusChanged: (userId: string, orderId: string, status: string) => void }} Stream bound to in-memory maps.
 */
function createOrderEventStream() {
  /** @type {Map<string, Set<import("express").Response>>} */
  const customerResponsesByUserId = new Map();
  /** @type {Set<import("express").Response>} */
  const adminResponses = new Set();

  /**
   * Registers an open customer SSE response for one user.
   *
   * @param {string} userId - Authenticated user id from the connection ticket.
   * @param {import("express").Response} response - Open, header-flushed SSE response.
   * @returns {void}
   * @sideEffects Adds the response; removes it when the connection closes.
   */
  function registerCustomer(userId, response) {
    const existingResponses = customerResponsesByUserId.get(userId);
    const userResponses = existingResponses || new Set();
    if (!existingResponses) {
      customerResponsesByUserId.set(userId, userResponses);
    }
    userResponses.add(response);
    response.on("close", () => {
      userResponses.delete(response);
      if (userResponses.size === 0) {
        customerResponsesByUserId.delete(userId);
      }
    });
  }

  /**
   * Registers an open admin SSE response.
   *
   * @param {import("express").Response} response - Open, header-flushed SSE response.
   * @returns {void}
   * @sideEffects Adds the response; removes it when the connection closes.
   */
  function registerAdmin(response) {
    adminResponses.add(response);
    response.on("close", () => {
      adminResponses.delete(response);
    });
  }

  /**
   * Writes a status change to that customer's streams and to every admin stream.
   *
   * @param {string} userId - Customer who owns the order.
   * @param {string} orderId - Order whose status changed.
   * @param {string} status - Status now stored on the order.
   * @returns {void}
   * @sideEffects Writes SSE frames. A missing customer or admin connection is a no-op for that side.
   */
  function broadcastStatusChanged(userId, orderId, status) {
    const serializedMessage = serializeStatusChanged(orderId, status);
    const customerResponses = customerResponsesByUserId.get(userId);
    if (customerResponses) {
      for (const customerResponse of customerResponses) {
        customerResponse.write(serializedMessage);
      }
    }
    for (const adminResponse of adminResponses) {
      adminResponse.write(serializedMessage);
    }
  }

  return { registerCustomer, registerAdmin, broadcastStatusChanged };
}

module.exports = {
  ORDER_STATUS_CHANGED_EVENT_NAME,
  createOrderEventStream,
};
