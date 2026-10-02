/**
 * Names shell auth and render contracts shared by every host.
 * Role: Holds topic and event strings for session, logout, and render requests.
 * Not in this file: Window CustomEvent names or header element events.
 * Key dependencies: None.
 * See also: src/createShellEvents.js.
 */

const AUTH_TOPIC = "auth";
const AUTH_SESSION_CHANGED_EVENT = "session-changed";
const AUTH_LOGOUT_REQUESTED_EVENT = "logout-requested";
const SHELL_TOPIC = "shell";
const RENDER_REQUESTED_EVENT = "render-requested";

export {
  AUTH_TOPIC,
  AUTH_SESSION_CHANGED_EVENT,
  AUTH_LOGOUT_REQUESTED_EVENT,
  SHELL_TOPIC,
  RENDER_REQUESTED_EVENT,
};
