/**
 * Publishes live post-like changes to the Event Mesh clients watching that post.
 * Role: Tracks community-likes/watching client ids per post id and publishes
 *   community-likes/changed only to the clients currently watching that post. Like counts are
 *   public, so guests may watch alongside signed-in users (unlike cart-sync's signed-in-only
 *   watching); gatewayAuth.js is what actually gates toggling a like to signed-in users.
 * Not in this file: Post-like persistence or the toggle rule (src/domain/postLikes.js), or the
 *   gateway subscriber that calls into this registry (src/event-mesh/postLikeHandler.js).
 * Key dependencies: event-mesh/gateway.
 * See also: src/event-mesh/postLikeHandler.js; src/server.js.
 *   On main this module writes Server-Sent Events; this branch publishes through the gateway.
 *
 * Unlike cart-sync (one user per client), one browser tab can have several post cards mounted
 * at once, so this registry is keyed both ways — postId -> client ids and client id -> post
 * ids — rather than cartEventStream's single-value-per-client mapping.
 */

const COMMUNITY_LIKES_TOPIC = "community-likes";
const COMMUNITY_LIKES_WATCHING_EVENT = "watching";
const COMMUNITY_LIKES_CHANGED_EVENT = "changed";

/**
 * Creates the per-post like-change publisher used after a toggle.
 *
 * @returns {{ forgetClient: (clientId: string) => void, rememberClient: (postId: string, clientId: string) => void, registerWithGateway: () => Promise<void>, broadcastLikesChanged: (postId: string, payload: object) => void }} Watcher registry and publisher.
 */
function createPostLikeEventStream() {
  /** @type {Map<string, Set<string>>} */
  const clientIdsByPostId = new Map();
  /** @type {Map<string, Set<string>>} */
  const postIdsByClientId = new Map();

  /**
   * Drops a mesh client from every post it was watching.
   *
   * @param {string} clientId - Gateway client id from onClientDisconnect.
   * @returns {void}
   * @sideEffects Removes the id from both watcher indexes.
   */
  function forgetClient(clientId) {
    const watchedPostIds = postIdsByClientId.get(clientId);
    if (!watchedPostIds) {
      return;
    }
    postIdsByClientId.delete(clientId);
    for (const postId of watchedPostIds) {
      const clientIds = clientIdsByPostId.get(postId);
      if (!clientIds) {
        continue;
      }
      clientIds.delete(clientId);
      if (clientIds.size === 0) {
        clientIdsByPostId.delete(postId);
      }
    }
  }

  /**
   * Records that a gateway client should receive one post's like changes. A client may watch
   * many posts at once (one per mounted card), so this adds rather than replaces.
   *
   * @param {string} postId - Post the sender's card is currently rendering.
   * @param {string} clientId - Gateway client id that announced watching.
   * @returns {void}
   * @sideEffects Adds to both watcher indexes.
   */
  function rememberClient(postId, clientId) {
    const existingClientIds = clientIdsByPostId.get(postId);
    const clientIds = existingClientIds || new Set();
    if (!existingClientIds) {
      clientIdsByPostId.set(postId, clientIds);
    }
    clientIds.add(clientId);

    const existingPostIds = postIdsByClientId.get(clientId);
    const postIds = existingPostIds || new Set();
    if (!existingPostIds) {
      postIdsByClientId.set(clientId, postIds);
    }
    postIds.add(postId);
  }

  /**
   * Subscribes to community-likes/watching and records the sender under the announced post id.
   *
   * @returns {Promise<void>}
   * @sideEffects Registers a gateway subscriber. Call after gateway.start().
   */
  async function registerWithGateway() {
    const gatewayModule = await import("event-mesh/gateway");
    const gateway = gatewayModule.default;

    gateway.subscribe(COMMUNITY_LIKES_TOPIC, COMMUNITY_LIKES_WATCHING_EVENT, (incomingMessage) => {
      const postId = incomingMessage.payload?.postId;
      const clientId = incomingMessage.sourceClientId;
      if (!postId || !clientId) {
        return;
      }
      rememberClient(postId, clientId);
    });
  }

  /**
   * Publishes one post's new like state to every client currently watching it.
   *
   * @param {string} postId - Post whose like state changed.
   * @param {object} payload - `{ postId, likes, ownerId, likerId, likerName, liked }`.
   * @returns {void}
   * @sideEffects Sends a targeted gateway.publish per watching client.
   */
  function broadcastLikesChanged(postId, payload) {
    void publishToWatchingClients(postId, payload);
  }

  /**
   * Sends community-likes/changed to each client id currently watching the post.
   *
   * @param {string} postId - Post whose like state changed.
   * @param {object} payload - JSON payload forwarded unchanged.
   * @returns {Promise<void>}
   * @sideEffects Publishes through the event-mesh gateway.
   */
  async function publishToWatchingClients(postId, payload) {
    const clientIds = clientIdsByPostId.get(postId);
    if (!clientIds || clientIds.size === 0) {
      return;
    }
    const gatewayModule = await import("event-mesh/gateway");
    const gateway = gatewayModule.default;
    for (const clientId of clientIds) {
      gateway.publish({
        topic: COMMUNITY_LIKES_TOPIC,
        event: COMMUNITY_LIKES_CHANGED_EVENT,
        payload,
        targetClientId: clientId,
      });
    }
  }

  return { forgetClient, rememberClient, registerWithGateway, broadcastLikesChanged };
}

module.exports = { createPostLikeEventStream };
