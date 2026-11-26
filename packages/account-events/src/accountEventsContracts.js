/**
 * Names account contracts shared by the account remote and the host shells.
 * Role: Holds the account topic, the profile-save-requested event name, and the profile-save payload check.
 * Not in this file: Auth storage or profile HTTP calls.
 * Key dependencies: None.
 * See also: src/createAccountEvents.js.
 */

/**
 * @typedef {{ fullName: string, gender: string }} ProfileSaveRequest
 */

const ACCOUNT_TOPIC = "account";
const ACCOUNT_PROFILE_SAVE_REQUESTED_EVENT = "profile-save-requested";

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
 * Checks whether a value can request saving a profile.
 *
 * @param {unknown} value - Candidate profile payload.
 * @returns {value is ProfileSaveRequest} Whether the payload has string fullName and gender.
 */
function isValidProfileSaveRequest(value) {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.fullName === "string" && typeof value.gender === "string";
}

export { ACCOUNT_TOPIC, ACCOUNT_PROFILE_SAVE_REQUESTED_EVENT, isValidProfileSaveRequest };
