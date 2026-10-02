/**
 * Names account contracts shared by the account remote and the host shells.
 * Role: Holds the profile-updated topic and event name.
 * Not in this file: Auth storage or profile HTTP calls.
 * Key dependencies: None.
 * See also: src/createAccountEvents.js.
 */

const ACCOUNT_TOPIC = "account";
const PROFILE_UPDATED_EVENT = "profile-updated";

export { ACCOUNT_TOPIC, PROFILE_UPDATED_EVENT };
