/**
 * Publishes live post-created activity to every connected social Event Mesh client.
 * Role: Tracks social client ids announced via community-posts/watching and publishes
 *   community-posts/created to all of them. New posts are public information (like post
 *   likes), so guests may watch alongside signed-in users — unlike admin/watching, there is no
 *   role check here.
 * Not in this file: Post persistence or the create rule (src/routes/postRoutes.js), or the
 *   per-post like-watcher registry (src/infrastructure/postLikeEventStream.js), which is keyed
 *   by post id instead of a single flat client set since a new post isn't scoped to one post.
 * Key dependencies: event-mesh/gateway.
 * See also: src/server.js; src/infrastructure/adminEventStream.js (same flat-registry shape).
 */

const COMMUNITY_POSTS_TOPIC = "community-posts";
const COMMUNITY_POSTS_WATCHING_EVENT = "watching";
const COMMUNITY_POSTS_CREATED_EVENT = "created";

/**
 * Creates the community post-created publisher used after a post is created.
 *
 * @returns {{ forgetClient: (clientId: string) => void, registerWithGateway: () => Promise<void>, broadcastPostCreated: (payload: object) => void }} Social client registry and publisher.
 */
function createCommunityPostEventStream() {
  /** @type {Set<string>} */
  const socialClientIds = new Set();

  /**
   * Drops a social client id when its WebSocket closes.
   *
   * @param {string} clientId - Gateway client id from onClientDisconnect.
   * @returns {void}
   * @sideEffects Removes the id from the social client set.
   */
  function forgetClient(clientId) {
    socialClientIds.delete(clientId);
  }

  /**
   * Subscribes to community-posts/watching and records every sender, signed in or guest.
   *
   * @returns {Promise<void>}
   * @sideEffects Registers a gateway subscriber. Call after gateway.start().
   */
  async function registerWithGateway() {
    const gatewayModule = await import("event-mesh/gateway");
    const gateway = gatewayModule.default;

    gateway.subscribe(COMMUNITY_POSTS_TOPIC, COMMUNITY_POSTS_WATCHING_EVENT, (incomingMessage) => {
      if (!incomingMessage.sourceClientId) {
        return;
      }
      socialClientIds.add(incomingMessage.sourceClientId);
    });
  }

  /**
   * Publishes one newly created post to every recorded social client.
   *
   * @param {object} payload - Post record already shaped with its author (see postRoutes.js).
   * @returns {void}
   * @sideEffects Sends a targeted gateway.publish per connected social client.
   */
  function broadcastPostCreated(payload) {
    void publishToSocialClients(payload);
  }

  /**
   * Sends community-posts/created to each social client id currently recorded.
   *
   * @param {object} payload - JSON payload forwarded unchanged.
   * @returns {Promise<void>}
   * @sideEffects Publishes through the event-mesh gateway.
   */
  async function publishToSocialClients(payload) {
    const gatewayModule = await import("event-mesh/gateway");
    const gateway = gatewayModule.default;

    for (const clientId of socialClientIds) {
      gateway.publish({
        topic: COMMUNITY_POSTS_TOPIC,
        event: COMMUNITY_POSTS_CREATED_EVENT,
        payload,
        targetClientId: clientId,
      });
    }
  }

  return { forgetClient, registerWithGateway, broadcastPostCreated };
}

module.exports = { createCommunityPostEventStream };
