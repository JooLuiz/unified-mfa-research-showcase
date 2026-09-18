/**
 * Publishes and subscribes to shared account Event Mesh messages.
 * Role: Hides mesh transport details behind profile and address save operations for remotes and shells.
 * Not in this file: Mesh configuration, HTTP account APIs, or UI rendering.
 * Key dependencies: An Event Mesh client supplied by the owning shell (remotes must not configureMesh).
 * See also: src/accountEventContracts.js; MESH_IMPLEMENTATIONS/remote-intents.md.
 */

import {
  ACCOUNT_ADDRESS_SAVE_REQUESTED_EVENT,
  ACCOUNT_PROFILE_SAVE_REQUESTED_EVENT,
  ACCOUNT_TOPIC,
  createAddressSaveRequest,
  createProfileSaveRequest,
  isValidAddressSaveRequest,
  isValidProfileSaveRequest,
} from "./accountEventContracts.js";

/**
 * Creates an account-scoped local event adapter for account remotes and host shells.
 *
 * @param {{ mesh: { publish: (input: object) => void, subscribe: (topic: string, event: string, callback: (message: object) => void) => () => void } }} adapterInput - Configured mesh client for the owning shell.
 * @returns {object} Account event adapter with publish helpers and intent listeners.
 */
function createAccountEvents({ mesh }) {
  let accountIntentListenersStarted = false;

  function publishLocalEvent(topic, event, payload = {}) {
    mesh.publish({ topic, event, payload, scope: "local" });
  }

  /**
   * Publishes a request to save the current user's profile fields.
   *
   * @param {{ fullName: string, gender: string }} profile - Profile fields from the account remote.
   * @returns {void}
   * @sideEffects Publishes a local account.profile-save-requested message when valid.
   */
  function publishProfileSaveRequested(profile) {
    const normalizedRequest = createProfileSaveRequest(profile);
    if (!normalizedRequest) {
      return;
    }

    publishLocalEvent(
      ACCOUNT_TOPIC,
      ACCOUNT_PROFILE_SAVE_REQUESTED_EVENT,
      normalizedRequest,
    );
  }

  /**
   * Publishes a request to save the current user's shipping address.
   *
   * @param {{ street: string, city: string, state: string, postalCode: string, country: string }} address - Address fields from the account remote.
   * @returns {void}
   * @sideEffects Publishes a local account.address-save-requested message when valid.
   */
  function publishAddressSaveRequested(address) {
    const normalizedRequest = createAddressSaveRequest(address);
    if (!normalizedRequest) {
      return;
    }

    publishLocalEvent(
      ACCOUNT_TOPIC,
      ACCOUNT_ADDRESS_SAVE_REQUESTED_EVENT,
      normalizedRequest,
    );
  }

  /**
   * Registers persistent account intent handlers after a mesh configuration change.
   *
   * @param {{
   *   onProfileSaveRequested?: (payload: { fullName: string, gender: string }) => void,
   *   onAddressSaveRequested?: (payload: object) => void,
   * }} handlers - Host orchestration handlers.
   * @returns {void}
   * @sideEffects Registers local mesh subscriptions for provided handlers.
   */
  function ensureAccountIntentListeners(handlers) {
    if (accountIntentListenersStarted) {
      return;
    }

    accountIntentListenersStarted = true;

    if (typeof handlers.onProfileSaveRequested === "function") {
      mesh.subscribe(
        ACCOUNT_TOPIC,
        ACCOUNT_PROFILE_SAVE_REQUESTED_EVENT,
        (message) => {
          if (isValidProfileSaveRequest(message.payload)) {
            handlers.onProfileSaveRequested(message.payload);
          }
        },
      );
    }

    if (typeof handlers.onAddressSaveRequested === "function") {
      mesh.subscribe(
        ACCOUNT_TOPIC,
        ACCOUNT_ADDRESS_SAVE_REQUESTED_EVENT,
        (message) => {
          if (isValidAddressSaveRequest(message.payload)) {
            handlers.onAddressSaveRequested(message.payload);
          }
        },
      );
    }
  }

  /**
   * Marks account intent subscriptions for re-registration after mesh.close() clears them.
   *
   * @returns {void}
   */
  function resetAccountIntentListeners() {
    accountIntentListenersStarted = false;
  }

  return {
    publishProfileSaveRequested,
    publishAddressSaveRequested,
    ensureAccountIntentListeners,
    resetAccountIntentListeners,
  };
}

export { createAccountEvents };
