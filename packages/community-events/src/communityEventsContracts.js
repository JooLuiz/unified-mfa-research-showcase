/**
 * Names community contracts shared by the formulary and the social shell.
 * Role: Holds the post-submitted topic and event name, and the post-submitted payload check.
 * Not in this file: Post HTTP persistence or iframe message types.
 * Key dependencies: None.
 * See also: src/createCommunityEvents.js.
 */

/**
 * @typedef {{ content: string, imageUrl: string }} PostSubmittedRequest
 */

const COMMUNITY_TOPIC = "community";
const POST_SUBMITTED_EVENT = "post-submitted";

/**
 * Checks whether a value is a non-null object.
 *
 * @param {unknown} value - Candidate payload.
 * @returns {value is Record<string, unknown>} Whether the value is an object.
 */
function isRecord(value) {
  return Boolean(value) && typeof value === "object";
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

export { COMMUNITY_TOPIC, POST_SUBMITTED_EVENT, isValidPostSubmittedRequest };
