/**
 * Public barrel for @shared/session-events.
 * Role: Exports session stream controls, revocation listener subscription, and sign-out command.
 * Not in this file: Stream internals or shell-specific listeners.
 * Key dependencies: None.
 * See also: src/sessionEventsClient.js, src/sessionRevocationCommands.js.
 */

export {
  SESSION_REVOKED_EVENT_NAME,
  SESSION_STREAM_PATH,
  SIGN_OUT_EVERYWHERE_PATH,
} from "./sessionEventsContracts.js";
export {
  startSessionStream,
  stopSessionStream,
  subscribeToSessionRevoked,
} from "./sessionEventsClient.js";
export { requestSignOutEverywhere } from "./sessionRevocationCommands.js";
