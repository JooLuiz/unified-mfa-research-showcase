/**
 * Broadcasts live admin events over open Server-Sent Events connections.
 * Role: Owns the in-memory set of open admin SSE responses and writes events to all of them.
 * Not in this file: Route handling, authentication, or event-specific payload shaping.
 * Key dependencies: None (pure Node `http.ServerResponse` writes).
 * See also: src/routes/adminRoutes.js (registers clients); src/routes/orderRoutes.js and
 *   src/routes/postRoutes.js (broadcast on mutation). This is the non-mesh transport for
 *   admin live updates; the mesh branch's equivalent is
 *   apps/mock-data-service/src/event-mesh/notificationEvents.js.
 */

/**
 * Creates an admin event stream broadcaster.
 *
 * @returns {{ registerClient: (response: import("express").Response) => void, broadcastEvent: (eventType: string, payload: object) => void }} Stream broadcaster bound to an in-memory client set.
 */
function createAdminEventStream() {
  /** @type {Set<import("express").Response>} */
  const connectedAdminClients = new Set();

  /**
   * Registers an open SSE response so it receives future broadcast events.
   *
   * @param {import("express").Response} response - Open, header-flushed SSE response.
   * @returns {void}
   * @sideEffects Adds the response to the client set; removes it when the connection closes.
   */
  function registerClient(response) {
    connectedAdminClients.add(response);
    response.on("close", () => {
      connectedAdminClients.delete(response);
    });
  }

  /**
   * Writes an event to every currently connected admin client.
   *
   * @param {string} eventType - SSE event name (e.g. "order_created").
   * @param {object} payload - JSON-serializable event payload.
   * @returns {void}
   * @sideEffects Writes to every open admin SSE response.
   */
  function broadcastEvent(eventType, payload) {
    const serializedMessage = `event: ${eventType}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const clientResponse of connectedAdminClients) {
      clientResponse.write(serializedMessage);
    }
  }

  return { registerClient, broadcastEvent };
}

module.exports = { createAdminEventStream };
