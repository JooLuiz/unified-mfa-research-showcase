/**
 * Pushes session revocation events to open browser tabs where that user is signed in.
 * Role: Owns the in-memory registry of open session SSE connections, keyed by user id.
 * Not in this file: Token parsing or route handling.
 * Key dependencies: None (pure Node response writes).
 * See also: src/routes/sessionRoutes.js.
 */

const SESSION_REVOKED_EVENT_NAME = "session.revoked";

/**
 * Formats one session.revoked Server-Sent Event frame.
 *
 * @returns {string} SSE frame.
 */
function serializeSessionRevoked() {
  return `event: ${SESSION_REVOKED_EVENT_NAME}\ndata: {}\n\n`;
}

/**
 * Creates a per-user session event stream registry.
 *
 * @returns {{
 *   rememberClient: (userId: string, clientId: string, response: import("express").Response) => void,
 *   forgetClient: (clientId: string) => void,
 *   broadcastSessionRevoked: (userId: string) => void
 * }}
 */
function createSessionEventStream() {
  /** @type {Map<string, Map<string, import("express").Response>>} userId -> (clientId -> response) */
  const clientsByUserId = new Map();
  /** @type {Map<string, string>} clientId -> userId */
  const userIdByClientId = new Map();

  /**
   * Remembers an open SSE client for a given user.
   *
   * @param {string} userId - Authenticated user identifier.
   * @param {string} clientId - Unique client/tab stream identifier.
   * @param {import("express").Response} response - Open SSE response object.
   */
  function rememberClient(userId, clientId, response) {
    let userClients = clientsByUserId.get(userId);
    if (!userClients) {
      userClients = new Map();
      clientsByUserId.set(userId, userClients);
    }
    userClients.set(clientId, response);
    userIdByClientId.set(clientId, userId);

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
    const userId = userIdByClientId.get(clientId);
    if (!userId) {
      return;
    }
    userIdByClientId.delete(clientId);
    const userClients = clientsByUserId.get(userId);
    if (userClients) {
      userClients.delete(clientId);
      if (userClients.size === 0) {
        clientsByUserId.delete(userId);
      }
    }
  }

  /**
   * Broadcasts session.revoked to all connected clients for the user, then ends the responses.
   *
   * @param {string} userId - User whose sessions have been revoked.
   */
  function broadcastSessionRevoked(userId) {
    const userClients = clientsByUserId.get(userId);
    if (!userClients) {
      return;
    }
    const frame = serializeSessionRevoked();
    // Copy references before iterating since close will mutate the map
    const clientResponses = Array.from(userClients.values());
    for (const clientResponse of clientResponses) {
      try {
        clientResponse.write(frame);
        clientResponse.end();
      } catch (error) {
        console.warn("broadcastSessionRevoked - clientResponse error");
        console.warn(error);
      }
    }
    clientsByUserId.delete(userId);
  }

  return {
    rememberClient,
    forgetClient,
    broadcastSessionRevoked,
  };
}

module.exports = {
  SESSION_REVOKED_EVENT_NAME,
  createSessionEventStream,
};
