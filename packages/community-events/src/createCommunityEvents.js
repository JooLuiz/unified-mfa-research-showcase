/**
 * Publishes and subscribes to shared community Event Mesh messages.
 * Role: Hides mesh transport details behind post, author, and formulary operations for remotes
 *   and shells, plus the one distributed publish a remote makes directly to the gateway
 *   (publishPostLikesWatching) for a public, non-authorized announcement.
 * Not in this file: Mesh configuration, HTTP post/FAQ APIs, UI rendering, the like-toggle
 *   request/reply, or the community-likes/changed subscription (both host-shell-owned; see
 *   apps/social-media-shell/src/commands/postLikeCommands.js and
 *   packages/post-like-events/src/postLikeEventsClient.js).
 * Key dependencies: An Event Mesh client supplied by the owning shell (remotes must not configureMesh).
 * See also: src/communityEventsContracts.js; MESH_IMPLEMENTATIONS/remote-intents.md.
 */

import {
  COMMUNITY_AUTHOR_SELECTED_EVENT,
  COMMUNITY_FAQ_SUBMITTED_EVENT,
  COMMUNITY_LIKES_TOPIC,
  COMMUNITY_LIKES_WATCHING_EVENT,
  COMMUNITY_POST_LIKED_EVENT,
  COMMUNITY_POST_SUBMITTED_EVENT,
  COMMUNITY_TOPIC,
  createFaqSubmittedRequest,
  isValidAuthorSelectedRequest,
  isValidFaqSubmittedRequest,
  isValidPostLikedRequest,
  isValidPostSubmittedRequest,
} from "./communityEventsContracts.js";

const MESH_CONNECT_TIMEOUT_MS = 5000;

/**
 * Creates a community-scoped local event adapter for social remotes and host shells.
 *
 * @param {{ publish: (input: object) => void, subscribe: (topic: string, event: string, callback: (message: object) => void) => () => void, whenConnected: (input: { timeoutMs: number }) => Promise<void> }} transport - Mesh client. publishPostLikesWatching uses whenConnected; the other operations use publish and subscribe.
 * @returns {object} Community event adapter with publish helpers and intent listeners.
 */
function createCommunityEvents(transport) {
  let communityIntentListenersStarted = false;

  function publishLocalEvent(topic, event, payload = {}) {
    transport.publish({ topic, event, payload, scope: "local" });
  }

  /**
   * Publishes that a post was liked in the feed remote.
   *
   * @param {string} postId - Community post identifier.
   * @returns {void}
   * @sideEffects Publishes a local community.post-liked message.
   */
  function publishPostLiked(postId) {
    if (typeof postId !== "string" || postId.trim() === "") {
      return;
    }

    publishLocalEvent(COMMUNITY_TOPIC, COMMUNITY_POST_LIKED_EVENT, { postId });
  }

  /**
   * Announces to the gateway that this client's post card wants live like-count updates for
   * one post. Unlike the local-only publishers above, this reaches the server directly (the
   * same per-entity-watch shape as @shared/stock-events' createStockWatchClient) because a
   * public like count is informational, not a mutation the host needs to authorize.
   *
   * @param {string} postId - Community post identifier being rendered.
   * @returns {void}
   * @sideEffects Publishes community-likes/watching with distributed scope once the mesh
   *   client is connected; silently gives up on timeout since the server also tolerates a
   *   missed announce (the card simply won't receive live updates for that post this time).
   */
  function publishPostLikesWatching(postId) {
    if (typeof postId !== "string" || postId.trim() === "") {
      return;
    }

    transport.whenConnected({ timeoutMs: MESH_CONNECT_TIMEOUT_MS })
      .then(() => {
        transport.publish({
          topic: COMMUNITY_LIKES_TOPIC,
          event: COMMUNITY_LIKES_WATCHING_EVENT,
          payload: { postId },
          scope: "distributed",
        });
      })
      .catch(() => {
        // Not connected within the timeout; this card just won't get live like updates.
      });
  }

  /**
   * Publishes that an author was selected in the feed remote.
   *
   * @param {object} author - Author object from the post payload.
   * @returns {void}
   * @sideEffects Publishes a local community.author-selected message.
   */
  function publishAuthorSelected(author) {
    if (!author || typeof author !== "object") {
      return;
    }

    publishLocalEvent(COMMUNITY_TOPIC, COMMUNITY_AUTHOR_SELECTED_EVENT, {
      author,
    });
  }

  /**
   * Publishes a community post-submitted payload as given.
   *
   * @param {object} [payload] - Post fields from the caller. The formulary validates content and imageUrl before calling this.
   * @returns {void}
   * @sideEffects Publishes a local community.post-submitted message.
   */
  function publishPostSubmitted(payload) {
    transport.publish({
      topic: COMMUNITY_TOPIC,
      event: COMMUNITY_POST_SUBMITTED_EVENT,
      payload,
      scope: "local",
    });
  }

  /**
   * Subscribes to post-submitted payloads until the returned function runs.
   *
   * @param {(payload: object) => void} listener - Called with each post-submitted payload.
   * @returns {() => void} Removes the subscription.
   * @sideEffects Registers a local community subscription. Does not drop a payload that lacks imageUrl.
   */
  function subscribeToPostSubmitted(listener) {
    return transport.subscribe(COMMUNITY_TOPIC, COMMUNITY_POST_SUBMITTED_EVENT, (message) => {
      listener(message.payload);
    });
  }

  /**
   * Publishes that an FAQ formulary was submitted.
   *
   * @param {{ name: string, email: string, contactMethod: string, question: string }} faq - FAQ fields from the formulary iframe.
   * @returns {void}
   * @sideEffects Publishes a local community.faq-submitted message when valid.
   */
  function publishFaqSubmitted(faq) {
    const normalizedRequest = createFaqSubmittedRequest(faq);
    if (!normalizedRequest) {
      return;
    }

    publishLocalEvent(
      COMMUNITY_TOPIC,
      COMMUNITY_FAQ_SUBMITTED_EVENT,
      normalizedRequest,
    );
  }

  /**
   * Registers persistent community intent handlers after a mesh configuration change.
   *
   * @param {{
   *   onPostLiked?: (payload: { postId: string }) => void,
   *   onAuthorSelected?: (payload: { author: object }) => void,
   *   onPostSubmitted?: (payload: { content: string, imageUrl: string }) => void,
   *   onFaqSubmitted?: (payload: object) => void,
   * }} handlers - Host orchestration handlers.
   * @returns {void}
   * @sideEffects Registers local mesh subscriptions for provided handlers.
   */
  function ensureCommunityIntentListeners(handlers) {
    if (communityIntentListenersStarted) {
      return;
    }

    communityIntentListenersStarted = true;

    if (typeof handlers.onPostLiked === "function") {
      transport.subscribe(COMMUNITY_TOPIC, COMMUNITY_POST_LIKED_EVENT, (message) => {
        if (isValidPostLikedRequest(message.payload)) {
          handlers.onPostLiked(message.payload);
        }
      });
    }

    if (typeof handlers.onAuthorSelected === "function") {
      transport.subscribe(
        COMMUNITY_TOPIC,
        COMMUNITY_AUTHOR_SELECTED_EVENT,
        (message) => {
          if (isValidAuthorSelectedRequest(message.payload)) {
            handlers.onAuthorSelected(message.payload);
          }
        },
      );
    }

    if (typeof handlers.onPostSubmitted === "function") {
      subscribeToPostSubmitted((payload) => {
        if (isValidPostSubmittedRequest(payload)) {
          handlers.onPostSubmitted(payload);
        }
      });
    }

    if (typeof handlers.onFaqSubmitted === "function") {
      transport.subscribe(
        COMMUNITY_TOPIC,
        COMMUNITY_FAQ_SUBMITTED_EVENT,
        (message) => {
          if (isValidFaqSubmittedRequest(message.payload)) {
            handlers.onFaqSubmitted(message.payload);
          }
        },
      );
    }
  }

  /**
   * Marks community intent subscriptions for re-registration after mesh.close() clears them.
   *
   * @returns {void}
   */
  function resetCommunityIntentListeners() {
    communityIntentListenersStarted = false;
  }

  return {
    publishPostLiked,
    publishPostLikesWatching,
    publishAuthorSelected,
    publishPostSubmitted,
    subscribeToPostSubmitted,
    publishFaqSubmitted,
    ensureCommunityIntentListeners,
    resetCommunityIntentListeners,
  };
}

export { createCommunityEvents };
