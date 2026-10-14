/**
 * Pushes session revocation notices to every open gateway connection.
 * Role: Publishes one session/revoked message carrying the revoked user id so each tab can
 *   decide whether that user is the one signed in locally.
 * Not in this file: The revocation write (src/domain/sessionRevocation.js) and the client-side
 *   user-id filter (packages/session-events/src/sessionLiveEventsClient.js).
 * Key dependencies: event-mesh/gateway.
 * See also: src/routes/sessionRoutes.js.
 *   On main this concern is served over Server-Sent Events; this branch publishes through the
 *   gateway. Delivery is a broadcast, not a watching-registry lookup: a reconnect assigns a
 *   new client id, and a targeted publish to the old id is dropped.
 */

const SESSION_TOPIC = "session";
const SESSION_REVOKED_EVENT = "revoked";

/**
 * Creates the session-revocation publisher used after a sign-out-everywhere write.
 *
 * @returns {{ registerWithGateway: () => Promise<void>, broadcastSessionRevoked: (userId: string) => void }} Gateway-backed publisher.
 */
function createSessionEventStream() {
  /** @type {{ publish: (input: { topic: string, event: string, payload: { userId: string } }) => void } | null} */
  let gateway = null;

  /**
   * Resolves the gateway singleton so a later broadcast does not yield on import().
   *
   * @returns {Promise<void>}
   * @sideEffects Caches event-mesh/gateway. Call after gateway.start().
   */
  async function registerWithGateway() {
    const gatewayModule = await import("event-mesh/gateway");
    gateway = gatewayModule.default;
  }

  /**
   * Publishes session/revoked to every open gateway socket.
   *
   * @param {string} userId - User whose sessions were just revoked.
   * @returns {void}
   * @sideEffects Sends one gateway.publish with no targetClientId. Each tab ignores the event
   *   unless payload.userId is the user it subscribed for.
   */
  function broadcastSessionRevoked(userId) {
    if (!gateway || !userId) {
      return;
    }

    gateway.publish({
      topic: SESSION_TOPIC,
      event: SESSION_REVOKED_EVENT,
      payload: { userId },
    });
  }

  return { registerWithGateway, broadcastSessionRevoked };
}

module.exports = { createSessionEventStream };
