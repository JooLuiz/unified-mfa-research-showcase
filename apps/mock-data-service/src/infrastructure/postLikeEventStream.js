/**
 * Broadcasts live social events over every open social Server-Sent Events connection.
 * Role: Owns the in-memory set of open social SSE responses and writes events to all of them.
 *   Started out carrying only `community.post-likes-changed`; `src/routes/postRoutes.js` now
 *   reuses this same registry (and the one open connection per tab) to push
 *   `community.post-created` too, instead of opening a second SSE connection. Guests and
 *   signed-in viewers connect to this stream the same way, since both likes and new posts are
 *   public information.
 * Not in this file: Route handling, authentication, or the toggle rule (src/domain/postLikes.js).
 * Key dependencies: None (pure Node `http.ServerResponse` writes).
 * See also: src/routes/postLikeRoutes.js (registers clients, broadcasts on toggle);
 *   src/routes/postRoutes.js (broadcasts on create); src/infrastructure/adminEventStream.js
 *   (the admin side reuses that existing broadcaster for the same events, rather than a
 *   second registry — the same idiom this file now follows for the social side).
 */

const POST_LIKES_CHANGED_EVENT_NAME = "community.post-likes-changed";
const POST_CREATED_EVENT_NAME = "community.post-created";

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
   * Writes one event to every currently connected social client. Shared by every event type
   * this stream carries (post-likes-changed, post-created, ...) so they all travel over the
   * same open connection per tab.
   *
   * @param {string} eventType - SSE event name (e.g. "community.post-created").
   * @param {object} payload - JSON-serializable event payload.
   * @returns {void}
   * @sideEffects Writes to every open social SSE response.
   */
  function broadcastEvent(eventType, payload) {
    const serializedMessage = `event: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const clientResponse of connectedSocialClients) {
      clientResponse.write(serializedMessage);
    }
  }

  /**
   * Writes a post-like change to every currently connected social client.
   *
   * @param {{ postId: string, likes: number, ownerId: string, likerName: string, liked: boolean }} payload - Event payload.
   * @returns {void}
   * @sideEffects Writes to every open social SSE response.
   */
  function broadcastLikesChanged(payload) {
    broadcastEvent(POST_LIKES_CHANGED_EVENT_NAME, payload);
  }

  return { registerClient, broadcastEvent, broadcastLikesChanged };
}

module.exports = {
  POST_LIKES_CHANGED_EVENT_NAME,
  POST_CREATED_EVENT_NAME,
  createPostLikeEventStream,
};
