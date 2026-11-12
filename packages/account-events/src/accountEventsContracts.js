/**
 * Defines shared local Event Mesh contracts for account save intents.
 * Role: Centralizes topic/event names and payload validators for profile and address saves.
 * Not in this file: Mesh publishing, HTTP persistence, or UI rendering.
 * Key dependencies: None.
 * See also: src/createAccountEvents.js; MESH_IMPLEMENTATIONS/remote-intents.md.
 */

const ACCOUNT_TOPIC = "account";
const ACCOUNT_PROFILE_SAVE_REQUESTED_EVENT = "profile-save-requested";
const ACCOUNT_ADDRESS_SAVE_REQUESTED_EVENT = "address-save-requested";

/**
 * @typedef {{ fullName: string, gender: string }} ProfileSaveRequest
 * @typedef {{ street: string, city: string, state: string, postalCode: string, country: string }} AddressSaveRequest
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

/**
 * Creates a safe profile-save payload for mesh delivery.
 *
 * @param {unknown} value - Candidate profile request.
 * @returns {ProfileSaveRequest | null} Normalized payload, or null when invalid.
 */
function createProfileSaveRequest(value) {
  if (!isValidProfileSaveRequest(value)) {
    return null;
  }

  return {
    fullName: value.fullName.trim(),
    gender: value.gender.trim(),
  };
}

/**
 * Checks whether a value can request saving an address.
 *
 * @param {unknown} value - Candidate address payload.
 * @returns {value is AddressSaveRequest} Whether the payload has the expected string fields.
 */
function isValidAddressSaveRequest(value) {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.street === "string" &&
    typeof value.city === "string" &&
    typeof value.state === "string" &&
    typeof value.postalCode === "string" &&
    typeof value.country === "string"
  );
}

/**
 * Creates a safe address-save payload for mesh delivery.
 *
 * @param {unknown} value - Candidate address request.
 * @returns {AddressSaveRequest | null} Normalized payload, or null when invalid.
 */
function createAddressSaveRequest(value) {
  if (!isValidAddressSaveRequest(value)) {
    return null;
  }

  return {
    street: value.street.trim(),
    city: value.city.trim(),
    state: value.state.trim(),
    postalCode: value.postalCode.trim(),
    country: value.country.trim(),
  };
}

export {
  ACCOUNT_ADDRESS_SAVE_REQUESTED_EVENT,
  ACCOUNT_PROFILE_SAVE_REQUESTED_EVENT,
  ACCOUNT_TOPIC,
  createAddressSaveRequest,
  createProfileSaveRequest,
  isValidAddressSaveRequest,
  isValidProfileSaveRequest,
};
