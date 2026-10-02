/**
 * Re-exports shared shell contracts for the admin shell.
 * Role: Keeps the phase 2 import path while the package contracts own the names.
 * Not in this file: Browser event mapping (src/events/browserTransport.js).
 * Key dependencies: @shared/shell-events.
 * See also: src/events/eventBus.js.
 */

export {
  AUTH_LOGOUT_REQUESTED_EVENT,
  AUTH_SESSION_CHANGED_EVENT,
  AUTH_TOPIC,
  RENDER_REQUESTED_EVENT,
  SHELL_TOPIC,
} from "@shared/shell-events";
