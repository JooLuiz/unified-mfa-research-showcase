/**
 * Publishes order status changes to the Event Mesh clients watching that order's customer.
 * Role: Tracks orders/watching client ids per user and publishes orders/status-changed only
 *   to those clients.
 * Not in this file: Transition rules (src/domain/orderStatus.js) or the status-change subscriber
 *   (src/event-mesh/orderStatusHandler.js).
 * Key dependencies: event-mesh/gateway.
 * See also: src/event-mesh/orderStatusHandler.js; src/server.js.
 *   On main this module writes Server-Sent Events; this branch publishes through the gateway.
 */

const ORDERS_TOPIC = "orders";
const ORDERS_WATCHING_EVENT = "watching";
const ORDERS_STATUS_CHANGED_EVENT = "status-changed";

/**
 * Creates the per-user order-status publisher used after a status write.
 *
 * @returns {{ forgetClient: (clientId: string) => void, rememberClient: (userId: string, clientId: string) => void, registerWithGateway: () => Promise<void>, broadcastStatusChanged: (userId: string, orderId: string, status: string) => void }} Watcher registry and publisher.
 */
function createOrderEventStream() {
  /** @type {Map<string, Set<string>>} */
  const clientIdsByUserId = new Map();
  /** @type {Map<string, string>} */
  const userIdByClientId = new Map();

  /**
   * Drops a mesh client from the user it was watching.
   *
   * @param {string} clientId - Gateway client id from onClientDisconnect.
   * @returns {void}
   * @sideEffects Removes the id from both watcher indexes.
   */
  function forgetClient(clientId) {
    const userId = userIdByClientId.get(clientId);
    if (!userId) {
      return;
    }
    userIdByClientId.delete(clientId);
    const clientIds = clientIdsByUserId.get(userId);
    if (!clientIds) {
      return;
    }
    clientIds.delete(clientId);
    if (clientIds.size === 0) {
      clientIdsByUserId.delete(userId);
    }
  }

  /**
   * Records that a gateway client should receive this user's order status changes.
   *
   * @param {string} userId - Authenticated user id from the connection credential.
   * @param {string} clientId - Gateway client id that announced watching.
   * @returns {void}
   * @sideEffects Replaces a previous user mapping when the same socket announces a different user.
   */
  function rememberClient(userId, clientId) {
    const previousUserId = userIdByClientId.get(clientId);
    if (previousUserId && previousUserId !== userId) {
      forgetClient(clientId);
    }
    const existingClientIds = clientIdsByUserId.get(userId);
    const clientIds = existingClientIds || new Set();
    if (!existingClientIds) {
      clientIdsByUserId.set(userId, clientIds);
    }
    clientIds.add(clientId);
    userIdByClientId.set(clientId, userId);
  }

  /**
   * Subscribes to orders/watching and records the sender under credential.userId.
   *
   * @returns {Promise<void>}
   * @sideEffects Registers a gateway subscriber. Call after gateway.start().
   */
  async function registerWithGateway() {
    const gatewayModule = await import("event-mesh/gateway");
    const gateway = gatewayModule.default;

    gateway.subscribe(ORDERS_TOPIC, ORDERS_WATCHING_EVENT, (incomingMessage) => {
      const userId = incomingMessage.credential?.userId;
      const clientId = incomingMessage.sourceClientId;
      if (!userId || !clientId) {
        return;
      }
      rememberClient(userId, clientId);
    });
  }

  /**
   * Publishes one order's new status to every recorded client for that order's customer.
   *
   * @param {string} userId - Customer who owns the order.
   * @param {string} orderId - Order whose status changed.
   * @param {string} status - Status now stored on the order.
   * @returns {void}
   * @sideEffects Sends a targeted gateway.publish per watching client.
   */
  function broadcastStatusChanged(userId, orderId, status) {
    void publishToUserClients(userId, orderId, status);
  }

  /**
   * Sends orders/status-changed to each client id currently recorded for the user.
   *
   * @param {string} userId - Customer who owns the order.
   * @param {string} orderId - Order whose status changed.
   * @param {string} status - JSON payload field forwarded unchanged.
   * @returns {Promise<void>}
   * @sideEffects Publishes through the event-mesh gateway.
   */
  async function publishToUserClients(userId, orderId, status) {
    const clientIds = clientIdsByUserId.get(userId);
    if (!clientIds || clientIds.size === 0) {
      return;
    }
    const gatewayModule = await import("event-mesh/gateway");
    const gateway = gatewayModule.default;
    for (const clientId of clientIds) {
      gateway.publish({
        topic: ORDERS_TOPIC,
        event: ORDERS_STATUS_CHANGED_EVENT,
        payload: { orderId, status },
        targetClientId: clientId,
      });
    }
  }

  return { forgetClient, rememberClient, registerWithGateway, broadcastStatusChanged };
}

module.exports = { createOrderEventStream };
