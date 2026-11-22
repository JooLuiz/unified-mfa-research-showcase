/**
 * Pushes session revocation notices to open gateway connections.
 * Role: Broadcasts session/revoked after sign-out-everywhere, and replies with that same
 *   event to a client that announces session/watching after its token is already revoked.
 * Not in this file: The revocation write (src/domain/sessionRevocation.js) or the client
 *   announce (packages/session-events/src/createSessionSession.js).
 * Key dependencies: event-mesh/gateway; sessionRevocations.json via jsonStore.
 * See also: src/routes/sessionRoutes.js.
 *   On main this concern is served over Server-Sent Events; this branch publishes through the
 *   gateway. The live sign-out stays an untargeted broadcast. A reconnect assigns a new client
 *   id, so the catch-up reply is addressed to sourceClientId from the watching announce.
 */

const { getRevokedAtForUser, isTokenRevoked } = require("../domain/sessionRevocation");

const SESSION_TOPIC = "session";
const SESSION_REVOKED_EVENT = "revoked";
const SESSION_WATCHING_EVENT = "watching";

/**
 * Creates the session-revocation publisher used after a sign-out-everywhere write.
 *
 * @returns {{ registerWithGateway: (jsonStore: { readJsonFileWithDefault: (fileName: string, defaultValue: unknown) => Promise<unknown> }) => Promise<void>, broadcastSessionRevoked: (userId: string) => void }} Gateway-backed publisher.
 */
function createSessionEventStream() {
  /** @type {{ publish: (input: object) => void, subscribe: (topic: string, event: string, callback: (message: object) => void) => void } | null} */
  let gateway = null;

  /**
   * Resolves the gateway singleton and subscribes to session/watching catch-up announces.
   *
   * @param {{ readJsonFileWithDefault: (fileName: string, defaultValue: unknown) => Promise<unknown> }} jsonStore - JSON file store bound to the data directory.
   * @returns {Promise<void>}
   * @sideEffects Caches event-mesh/gateway and registers the watching subscriber. Call after gateway.start().
   */
  async function registerWithGateway(jsonStore) {
    const gatewayModule = await import("event-mesh/gateway");
    gateway = gatewayModule.default;

    gateway.subscribe(SESSION_TOPIC, SESSION_WATCHING_EVENT, (incomingMessage) => {
      void replyIfConnectionRevoked(jsonStore, incomingMessage);
    });
  }

  /**
   * Publishes session/revoked to the announcing client when that connection's token is revoked.
   *
   * @param {{ readJsonFileWithDefault: (fileName: string, defaultValue: unknown) => Promise<unknown> }} jsonStore - Store that reads sessionRevocations.json.
   * @param {{ credential?: { userId?: string, tokenIssuedAt?: number }, sourceClientId?: string }} incomingMessage - session/watching message from the gateway.
   * @returns {Promise<void>}
   * @sideEffects Sends one targeted gateway.publish when isTokenRevoked is true. Does nothing otherwise.
   */
  async function replyIfConnectionRevoked(jsonStore, incomingMessage) {
    const userId = incomingMessage.credential?.userId;
    const clientId = incomingMessage.sourceClientId;
    const tokenIssuedAt = incomingMessage.credential?.tokenIssuedAt;
    if (!gateway || !userId || !clientId || !Number.isFinite(tokenIssuedAt)) {
      return;
    }

    const sessionRevocations = await jsonStore.readJsonFileWithDefault("sessionRevocations.json", []);
    const revokedAt = getRevokedAtForUser(sessionRevocations, userId);
    if (!isTokenRevoked(tokenIssuedAt, revokedAt)) {
      return;
    }

    gateway.publish({
      topic: SESSION_TOPIC,
      event: SESSION_REVOKED_EVENT,
      payload: { userId },
      targetClientId: clientId,
    });
  }

  /**
   * Publishes session/revoked to every open gateway socket.
   *
   * @param {string} userId - User whose sessions were just revoked.
   * @returns {void}
   * @sideEffects Sends one gateway.publish with no targetClientId.
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
