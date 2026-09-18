/**
 * Defines shared local Event Mesh contracts for community intents.
 * Role: Centralizes topic/event names and payload validators for posts, likes, authors, and formulary submits.
 * Not in this file: Mesh publishing, HTTP persistence, or UI rendering.
 * Key dependencies: None.
 * See also: src/createCommunityEvents.js; MESH_IMPLEMENTATIONS/remote-intents.md.
 */

const COMMUNITY_TOPIC = "community";
const COMMUNITY_POST_LIKED_EVENT = "post-liked";
const COMMUNITY_AUTHOR_SELECTED_EVENT = "author-selected";
const COMMUNITY_POST_SUBMITTED_EVENT = "post-submitted";
const COMMUNITY_FAQ_SUBMITTED_EVENT = "faq-submitted";

/**
 * @typedef {{ postId: string }} PostLikedRequest
 * @typedef {{ author: object }} AuthorSelectedRequest
 * @typedef {{ content: string, imageUrl: string }} PostSubmittedRequest
 * @typedef {{ name: string, email: string, contactMethod: string, question: string }} FaqSubmittedRequest
 */

function isRecord(value) {
  return Boolean(value) && typeof value === "object";
}

/**
 * Checks whether a value can request liking a post.
 *
 * @param {unknown} value - Candidate like payload.
 * @returns {value is PostLikedRequest} Whether the payload has a non-empty post id.
 */
function isValidPostLikedRequest(value) {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.postId === "string" && value.postId.trim() !== "";
}

/**
 * Checks whether a value can request selecting an author.
 *
 * @param {unknown} value - Candidate author payload.
 * @returns {value is AuthorSelectedRequest} Whether the payload has an author object.
 */
function isValidAuthorSelectedRequest(value) {
  if (!isRecord(value)) {
    return false;
  }

  return isRecord(value.author);
}

/**
 * Checks whether a value can request publishing a new post.
 *
 * @param {unknown} value - Candidate post-submit payload.
 * @returns {value is PostSubmittedRequest} Whether the payload has content and imageUrl strings.
 */
function isValidPostSubmittedRequest(value) {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.content === "string" && typeof value.imageUrl === "string";
}

/**
 * Creates a safe post-submitted payload for mesh delivery.
 *
 * @param {unknown} value - Candidate post submit request.
 * @returns {PostSubmittedRequest | null} Normalized payload, or null when invalid.
 */
function createPostSubmittedRequest(value) {
  if (!isValidPostSubmittedRequest(value)) {
    return null;
  }

  return {
    content: value.content,
    imageUrl: value.imageUrl,
  };
}

/**
 * Checks whether a value can request submitting an FAQ formulary.
 *
 * @param {unknown} value - Candidate FAQ payload.
 * @returns {value is FaqSubmittedRequest} Whether the payload has the expected string fields.
 */
function isValidFaqSubmittedRequest(value) {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.name === "string" &&
    typeof value.email === "string" &&
    typeof value.contactMethod === "string" &&
    typeof value.question === "string"
  );
}

/**
 * Creates a safe FAQ-submitted payload for mesh delivery.
 *
 * @param {unknown} value - Candidate FAQ submit request.
 * @returns {FaqSubmittedRequest | null} Normalized payload, or null when invalid.
 */
function createFaqSubmittedRequest(value) {
  if (!isValidFaqSubmittedRequest(value)) {
    return null;
  }

  return {
    name: value.name,
    email: value.email,
    contactMethod: value.contactMethod,
    question: value.question,
  };
}

export {
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
};
