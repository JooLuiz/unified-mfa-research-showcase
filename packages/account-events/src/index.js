/**
 * Exposes shared account Event Mesh contracts.
 * Role: Public barrel for account save-request names and the account event factory.
 * Not in this file: Event behavior or mesh configuration.
 * Key dependencies: None.
 * See also: src/createAccountEvents.js; src/accountEventContracts.js.
 */

export {
  ACCOUNT_ADDRESS_SAVE_REQUESTED_EVENT,
  ACCOUNT_PROFILE_SAVE_REQUESTED_EVENT,
  ACCOUNT_TOPIC,
  createAddressSaveRequest,
  createProfileSaveRequest,
  isValidAddressSaveRequest,
  isValidProfileSaveRequest,
} from "./accountEventContracts.js";
export { createAccountEvents } from "./createAccountEvents.js";
