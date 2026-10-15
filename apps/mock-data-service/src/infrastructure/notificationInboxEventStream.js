/**
 * Publishes notification-inbox changes to the Event Mesh clients watching that user and shell.
 * Role: Tracks notification-inbox/watching client ids per (userId, shell) and publishes
 *   notification-inbox/changed only to them.
 * Not in this file: Inbox persistence or the mark-read subscriber
 *   (src/event-mesh/notificationInboxHandler.js).
 * Key dependencies: event-mesh/gateway.
 * See also: src/infrastructure/cartEventStream.js; src/server.js.
 *   On main this module writes Server-Sent Events; this branch publishes through the gateway.
 */

const NOTIFICATION_INBOX_TOPIC = "notification-inbox";
const NOTIFICATION_INBOX_WATCHING_EVENT = "watching";
const NOTIFICATION_INBOX_CHANGED_EVENT = "changed";

/**
 * Builds the composite registry key for one user inside one shell.
 *
 * @param {string} userId - Authenticated user id.
 * @param {string} shell - Shell name (`ecommerce`, `social`, or `admin`).
 * @returns {string} Registry key.
 */
function buildWatcherKey(userId, shell) {
  return `${userId}:${shell}`;
}

/**
 * Creates the per-(userId, shell) notification publisher used after an inbox row changes.
 *
 * @returns {{ forgetClient: (clientId: string) => void, rememberClient: (userId: string, shell: string, clientId: string) => void, registerWithGateway: () => Promise<void>, broadcastNotificationChanged: (userId: string, shell: string, notification: object) => void }} Watcher registry and publisher.
 */
function createNotificationInboxEventStream() {
  /** @type {Map<string, Set<string>>} */
  const clientIdsByKey = new Map();
  /** @type {Map<string, string>} */
  const keyByClientId = new Map();

  /**
   * Drops a mesh client from the (user, shell) pair it was watching.
   *
   * @param {string} clientId - Gateway client id from onClientDisconnect.
   * @returns {void}
   * @sideEffects Removes the id from both watcher indexes.
   */
  function forgetClient(clientId) {
    const watcherKey = keyByClientId.get(clientId);
    if (!watcherKey) {
      return;
    }
    keyByClientId.delete(clientId);
    const clientIds = clientIdsByKey.get(watcherKey);
    if (!clientIds) {
      return;
    }
    clientIds.delete(clientId);
    if (clientIds.size === 0) {
      clientIdsByKey.delete(watcherKey);
    }
  }

  /**
   * Records that a gateway client should receive this user's inbox changes for one shell.
   *
   * @param {string} userId - Authenticated user id from the connection credential.
   * @param {string} shell - Shell the client announced it is watching.
   * @param {string} clientId - Gateway client id that announced watching.
   * @returns {void}
   * @sideEffects Replaces a previous key mapping when the same socket announces a different pair.
   */
  function rememberClient(userId, shell, clientId) {
    const watcherKey = buildWatcherKey(userId, shell);
    const previousKey = keyByClientId.get(clientId);
    if (previousKey && previousKey !== watcherKey) {
      forgetClient(clientId);
    }
    const existingClientIds = clientIdsByKey.get(watcherKey);
    const clientIds = existingClientIds || new Set();
    if (!existingClientIds) {
      clientIdsByKey.set(watcherKey, clientIds);
    }
    clientIds.add(clientId);
    keyByClientId.set(clientId, watcherKey);
  }

  /**
   * Subscribes to notification-inbox/watching and records the sender under credential.userId.
   *
   * @returns {Promise<void>}
   * @sideEffects Registers a gateway subscriber. Call after gateway.start().
   */
  async function registerWithGateway() {
    const gatewayModule = await import("event-mesh/gateway");
    const gateway = gatewayModule.default;

    gateway.subscribe(NOTIFICATION_INBOX_TOPIC, NOTIFICATION_INBOX_WATCHING_EVENT, (incomingMessage) => {
      const userId = incomingMessage.credential?.userId;
      const clientId = incomingMessage.sourceClientId;
      const shell = incomingMessage.payload?.shell;
      if (!userId || !clientId || typeof shell !== "string" || shell.trim() === "") {
        return;
      }
      rememberClient(userId, shell, clientId);
    });
  }

  /**
   * Publishes one inbox row to every recorded client for that user and shell.
   *
   * @param {string} userId - User whose inbox row changed.
   * @param {string} shell - Shell the row belongs to.
   * @param {object} notification - Canonical inbox row.
   * @returns {void}
   * @sideEffects Sends a targeted gateway.publish per watching client.
   */
  function broadcastNotificationChanged(userId, shell, notification) {
    void publishToWatchingClients(userId, shell, notification);
  }

  /**
   * Sends notification-inbox/changed to each client id currently recorded for the pair.
   *
   * @param {string} userId - User whose inbox row changed.
   * @param {string} shell - Shell the row belongs to.
   * @param {object} notification - JSON payload forwarded unchanged.
   * @returns {Promise<void>}
   * @sideEffects Publishes through the event-mesh gateway.
   */
  async function publishToWatchingClients(userId, shell, notification) {
    const clientIds = clientIdsByKey.get(buildWatcherKey(userId, shell));
    if (!clientIds || clientIds.size === 0) {
      return;
    }
    const gatewayModule = await import("event-mesh/gateway");
    const gateway = gatewayModule.default;
    for (const clientId of clientIds) {
      gateway.publish({
        topic: NOTIFICATION_INBOX_TOPIC,
        event: NOTIFICATION_INBOX_CHANGED_EVENT,
        payload: notification,
        targetClientId: clientId,
      });
    }
  }

  return { forgetClient, rememberClient, registerWithGateway, broadcastNotificationChanged };
}

module.exports = { createNotificationInboxEventStream };
