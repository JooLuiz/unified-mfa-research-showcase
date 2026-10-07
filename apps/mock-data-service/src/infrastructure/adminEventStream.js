/**
 * Publishes live admin activity to connected admin Event Mesh clients.
 * Role: Tracks admin WebSocket client ids announced via admin/watching and publishes
 *   order_created and post_created only to those clients.
 * Not in this file: Order or post persistence, toast copy, or gateway authentication.
 * Key dependencies: event-mesh/gateway.
 * See also: src/event-mesh/orderRequestHandler.js; src/routes/postRoutes.js; src/server.js.
 *   On main this module writes Server-Sent Events; this branch publishes through the gateway.
 */

const ADMIN_TOPIC = "admin";
const ADMIN_WATCHING_EVENT = "watching";

/**
 * Creates the admin activity publisher used by order and post producers.
 *
 * @returns {{ forgetClient: (clientId: string) => void, registerWithGateway: () => Promise<void>, broadcastEvent: (eventType: string, payload: object) => void }} Admin client registry and publisher.
 */
function createAdminEventStream() {
  /** @type {Set<string>} */
  const adminClientIds = new Set();

  /**
   * Drops an admin client id when its WebSocket closes.
   *
   * @param {string} clientId - Gateway client id from onClientDisconnect.
   * @returns {void}
   * @sideEffects Removes the id from the admin client set.
   */
  function forgetClient(clientId) {
    adminClientIds.delete(clientId);
  }

  /**
   * Subscribes to admin/watching and records the sender when the credential is an admin.
   *
   * @returns {Promise<void>}
   * @sideEffects Registers a gateway subscriber. Call after gateway.start().
   */
  async function registerWithGateway() {
    const gatewayModule = await import("event-mesh/gateway");
    const gateway = gatewayModule.default;

    gateway.subscribe(ADMIN_TOPIC, ADMIN_WATCHING_EVENT, (incomingMessage) => {
      const roles = incomingMessage.credential?.roles;
      const isAdminCredential = Array.isArray(roles) && roles.includes("admin");
      if (!isAdminCredential || !incomingMessage.sourceClientId) {
        return;
      }
      adminClientIds.add(incomingMessage.sourceClientId);
    });
  }

  /**
   * Publishes one admin activity event to every recorded admin client.
   *
   * @param {string} eventType - Mesh event name, order_created or post_created.
   * @param {object} payload - Order or post record already shaped for the admin tables.
   * @returns {void}
   * @sideEffects Sends a targeted gateway.publish per connected admin client.
   */
  function broadcastEvent(eventType, payload) {
    void publishToAdminClients(eventType, payload);
  }

  /**
   * Sends the activity event to each admin client id currently recorded.
   *
   * @param {string} eventType - Mesh event name.
   * @param {object} payload - JSON payload forwarded unchanged.
   * @returns {Promise<void>}
   * @sideEffects Publishes through the event-mesh gateway.
   */
  async function publishToAdminClients(eventType, payload) {
    const gatewayModule = await import("event-mesh/gateway");
    const gateway = gatewayModule.default;

    for (const clientId of adminClientIds) {
      gateway.publish({
        topic: ADMIN_TOPIC,
        event: eventType,
        payload,
        targetClientId: clientId,
      });
    }
  }

  return { forgetClient, registerWithGateway, broadcastEvent };
}

module.exports = { createAdminEventStream };
