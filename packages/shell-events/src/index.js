/**
 * Exposes shared shell-local Event Mesh event adapters.
 * Role: Public barrel for shell auth/navigation event contracts.
 * Not in this file: Event behavior, mesh configuration, or shell orchestration.
 * Key dependencies: None.
 * See also: src/createShellEvents.js; src/shellEventContracts.js.
 */

export { createShellEvents } from "./createShellEvents.js";
export {
  AUTH_LOGOUT_REQUESTED_EVENT,
  AUTH_SESSION_CHANGED_EVENT,
  AUTH_TOPIC,
  NAVIGATION_PATH_REQUESTED_EVENT,
  NAVIGATION_POST_LOGIN_REDIRECT_CHANGED_EVENT,
  NAVIGATION_RENDER_REQUESTED_EVENT,
  NAVIGATION_TOPIC,
} from "./shellEventContracts.js";
