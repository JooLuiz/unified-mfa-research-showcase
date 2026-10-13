/**
 * Broadcasts live post-like events over every open social Server-Sent Events connection.
 * Role: Owns the in-memory set of open social SSE responses and writes `community.post-likes-changed`
 *   events to all of them. Guests and signed-in viewers connect to this stream the same way,
 *   since the like count itself is public information.
 * Not in this file: Route handling, authentication, or the toggle rule (src/domain/postLikes.js).
 * Key dependencies: None (pure Node `http.ServerResponse` writes).
 * See also: src/routes/postLikeRoutes.js (registers clients, broadcasts on toggle);
 *   src/infrastructure/adminEventStream.js (the admin side reuses that existing broadcaster
 *   for the same event, rather than a second registry).
 */

const POST_LIKES_CHANGED_EVENT_NAME = "community.post-likes-changed";

/**
 * Creates a post-like event stream broadcaster.
 *
 * @returns {{ registerClient: (response: import("express").Response) => void, broadcastLikesChanged: (payload: { postId: string, likes: number, ownerId: string, likerName: string, liked: boolean }) => void }} Stream broadcaster bound to an in-memory client set.
 */
function createPostLikeEventStream() {
  /** @type {Set<import("express").Response>} */
  const connectedSocialClients = new Set();

  /**
   * Registers an open SSE response so it receives future broadcast events.
   *
   * @param {import("express").Response} response - Open, header-flushed SSE response.
   * @returns {void}
   * @sideEffects Adds the response to the client set; removes it when the connection closes.
   */
  function registerClient(response) {
    connectedSocialClients.add(response);
    response.on("close", () => {
      connectedSocialClients.delete(response);
    });
  }

  /**
   * Writes a post-like change to every currently connected social client.
   *
   * @param {{ postId: string, likes: number, ownerId: string, likerName: string, liked: boolean }} payload - Event payload.
   * @returns {void}
   * @sideEffects Writes to every open social SSE response.
   */
  function broadcastLikesChanged(payload) {
    const serializedMessage = `event: ${POST_LIKES_CHANGED_EVENT_NAME}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const clientResponse of connectedSocialClients) {
      clientResponse.write(serializedMessage);
    }
  }

  return { registerClient, broadcastLikesChanged };
}

module.exports = { POST_LIKES_CHANGED_EVENT_NAME, createPostLikeEventStream };
