/**
 * Registry of open Server-Sent Events clients for the notification inbox.
 * Role: Manages SSE connections partitioned by the composite key (userId, shell),
 *   allowing targeted broadcasts to affected browser tabs.
 * Not in this file: Token resolution or HTTP request routing.
 * Key dependencies: None.
 * See also: src/routes/notificationInboxRoutes.js, src/domain/notificationTriggers.js.
 */

const NOTIFICATION_CHANGED_EVENT_NAME = "notification-inbox.changed";

/**
 * Serializes a notification change event into an SSE frame.
 *
 * @param {object} notification - Stored notification row.
 * @returns {string} SSE frame.
 */
function serializeNotificationChanged(notification) {
  return `event: ${NOTIFICATION_CHANGED_EVENT_NAME}\ndata: ${JSON.stringify(notification)}\n\n`;
}

/**
 * Builds the composite map key.
 *
 * @param {string} userId - User identifier.
 * @param {string} shell - Shell identifier.
 * @returns {string} Composite key.
 */
function buildCompositeKey(userId, shell) {
  return `${userId}:${shell}`;
}

/**
 * Creates a notification inbox event stream registry.
 *
 * @returns {{
 *   rememberClient: (userId: string, shell: string, clientId: string, response: import("express").Response) => void,
 *   forgetClient: (clientId: string) => void,
 *   broadcastNotificationChanged: (userId: string, shell: string, notification: object) => void
 * }}
 */
function createNotificationInboxEventStream() {
  /** @type {Map<string, Map<string, import("express").Response>>} key -> (clientId -> response) */
  const clientsByKey = new Map();
  /** @type {Map<string, string>} clientId -> key */
  const keyByClientId = new Map();

  /**
   * Remembers an open SSE connection for a given (userId, shell) pair.
   *
   * @param {string} userId - Target user identifier.
   * @param {string} shell - Target shell identifier.
   * @param {string} clientId - Unique client/tab stream identifier.
   * @param {import("express").Response} response - Open Express SSE response.
   */
  function rememberClient(userId, shell, clientId, response) {
    const compositeKey = buildCompositeKey(userId, shell);
    let keyClients = clientsByKey.get(compositeKey);
    if (!keyClients) {
      keyClients = new Map();
      clientsByKey.set(compositeKey, keyClients);
    }
    keyClients.set(clientId, response);
    keyByClientId.set(clientId, compositeKey);

    response.on("close", () => {
      forgetClient(clientId);
    });
  }

  /**
   * Forgets a client connection by client identifier.
   *
   * @param {string} clientId - Stream identifier to forget.
   */
  function forgetClient(clientId) {
    const compositeKey = keyByClientId.get(clientId);
    if (!compositeKey) {
      return;
    }
    keyByClientId.delete(clientId);
    const keyClients = clientsByKey.get(compositeKey);
    if (keyClients) {
      keyClients.delete(clientId);
      if (keyClients.size === 0) {
        clientsByKey.delete(compositeKey);
      }
    }
  }

  /**
   * Broadcasts a notification row to all clients registered for the given user and shell.
   *
   * @param {string} userId - Target user identifier.
   * @param {string} shell - Target shell identifier.
   * @param {object} notification - Notification row payload.
   */
  function broadcastNotificationChanged(userId, shell, notification) {
    const compositeKey = buildCompositeKey(userId, shell);
    const keyClients = clientsByKey.get(compositeKey);
    if (!keyClients) {
      return;
    }
    const frame = serializeNotificationChanged(notification);
    for (const clientResponse of keyClients.values()) {
      try {
        clientResponse.write(frame);
      } catch (error) {
        console.warn("broadcastNotificationChanged - write error");
        console.warn(error);
      }
    }
  }

  return {
    rememberClient,
    forgetClient,
    broadcastNotificationChanged,
  };
}

module.exports = {
  NOTIFICATION_CHANGED_EVENT_NAME,
  createNotificationInboxEventStream,
};
