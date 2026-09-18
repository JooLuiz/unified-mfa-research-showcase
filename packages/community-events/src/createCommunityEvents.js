/**
 * Publishes and subscribes to shared community Event Mesh messages.
 * Role: Hides mesh transport details behind post, author, and formulary operations for remotes and shells.
 * Not in this file: Mesh configuration, HTTP post/FAQ APIs, or UI rendering.
 * Key dependencies: An Event Mesh client supplied by the owning shell (remotes must not configureMesh).
 * See also: src/communityEventContracts.js; MESH_IMPLEMENTATIONS/remote-intents.md.
 */

import {
  COMMUNITY_AUTHOR_SELECTED_EVENT,
  COMMUNITY_FAQ_SUBMITTED_EVENT,
  COMMUNITY_POST_LIKED_EVENT,
  COMMUNITY_POST_SUBMITTED_EVENT,
  COMMUNITY_TOPIC,
  createFaqSubmittedRequest,
  createPostSubmittedRequest,
  isValidAuthorSelectedRequest,
  isValidFaqSubmittedRequest,
  isValidPostLikedRequest,
  isValidPostSubmittedRequest,
} from "./communityEventContracts.js";

/**
 * Creates a community-scoped local event adapter for social remotes and host shells.
 *
 * @param {{ mesh: { publish: (input: object) => void, subscribe: (topic: string, event: string, callback: (message: object) => void) => () => void } }} adapterInput - Configured mesh client for the owning shell.
 * @returns {object} Community event adapter with publish helpers and intent listeners.
 */
function createCommunityEvents({ mesh }) {
  let communityIntentListenersStarted = false;

  function publishLocalEvent(topic, event, payload = {}) {
    mesh.publish({ topic, event, payload, scope: "local" });
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
   * Publishes that a new post formulary was submitted.
   *
   * @param {{ content: string, imageUrl: string }} post - Post body from the formulary iframe.
   * @returns {void}
   * @sideEffects Publishes a local community.post-submitted message when valid.
   */
  function publishPostSubmitted(post) {
    const normalizedRequest = createPostSubmittedRequest(post);
    if (!normalizedRequest) {
      return;
    }

    publishLocalEvent(
      COMMUNITY_TOPIC,
      COMMUNITY_POST_SUBMITTED_EVENT,
      normalizedRequest,
    );
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
      mesh.subscribe(COMMUNITY_TOPIC, COMMUNITY_POST_LIKED_EVENT, (message) => {
        if (isValidPostLikedRequest(message.payload)) {
          handlers.onPostLiked(message.payload);
        }
      });
    }

    if (typeof handlers.onAuthorSelected === "function") {
      mesh.subscribe(
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
      mesh.subscribe(
        COMMUNITY_TOPIC,
        COMMUNITY_POST_SUBMITTED_EVENT,
        (message) => {
          if (isValidPostSubmittedRequest(message.payload)) {
            handlers.onPostSubmitted(message.payload);
          }
        },
      );
    }

    if (typeof handlers.onFaqSubmitted === "function") {
      mesh.subscribe(
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
    publishAuthorSelected,
    publishPostSubmitted,
    publishFaqSubmitted,
    ensureCommunityIntentListeners,
    resetCommunityIntentListeners,
  };
}

export { createCommunityEvents };
