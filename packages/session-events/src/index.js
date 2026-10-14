/**
 * Public barrel for @shared/session-events.
 * Role: Exports the mesh-backed live session controls, revocation listener subscription, and
 *   sign-out command.
 * Not in this file: Client internals or shell-specific listeners.
 * Key dependencies: None.
 * See also: src/sessionLiveEventsClient.js, src/sessionRevocationCommands.js.
 */

export {
  SESSION_TOPIC,
  SESSION_REVOKED_EVENT,
  SIGN_OUT_EVERYWHERE_PATH,
} from "./sessionEventsContracts.js";
export {
  startSessionLiveEvents,
  stopSessionLiveEvents,
  subscribeToSessionRevoked,
} from "./sessionLiveEventsClient.js";
export { requestSignOutEverywhere } from "./sessionRevocationCommands.js";
