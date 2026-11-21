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
 *   writeSessionRevoked: (response: import("express").Response) => void,
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
   * Writes one session.revoked frame and ends that response.
   * Does not register the client. A late open and a live broadcast share this frame.
   *
   * @param {import("express").Response} response - SSE response that should receive the frame.
   * @returns {void}
   * @sideEffects Writes `event: session.revoked` / `data: {}` and ends the response.
   */
  function writeSessionRevoked(response) {
    response.write(serializeSessionRevoked());
    response.end();
  }

  /**
   * Broadcasts session.revoked to all connected clients for the user, then ends the responses.
   *
   * @param {string} userId - User whose sessions have been revoked.
   * @returns {void}
   * @sideEffects Writes the frame to each open response for that user and drops the registry entry.
   */
  function broadcastSessionRevoked(userId) {
    const userClients = clientsByUserId.get(userId);
    if (!userClients) {
      return;
    }
    // Copy references before iterating since close will mutate the map
    const clientResponses = Array.from(userClients.values());
    for (const clientResponse of clientResponses) {
      try {
        writeSessionRevoked(clientResponse);
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
    writeSessionRevoked,
    broadcastSessionRevoked,
  };
}

module.exports = {
  SESSION_REVOKED_EVENT_NAME,
  createSessionEventStream,
};
