/**
 * Names account contracts shared by the account remote and the host shells.
 * Role: Holds the account topic and the profile-save-requested event name.
 * Not in this file: Auth storage or profile HTTP calls.
 * Key dependencies: None.
 * See also: src/createAccountEvents.js.
 */

const ACCOUNT_TOPIC = "account";
const ACCOUNT_PROFILE_SAVE_REQUESTED_EVENT = "profile-save-requested";

export { ACCOUNT_TOPIC, ACCOUNT_PROFILE_SAVE_REQUESTED_EVENT };
