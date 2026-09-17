/**
 * Defines shared local Event Mesh contracts for application shell coordination.
 * Role: Centralizes auth and navigation topic/event names used by all shells.
 * Not in this file: Mesh publishing, subscriptions, authentication state, or rendering.
 * Key dependencies: None.
 * See also: src/createShellEvents.js.
 */

const NAVIGATION_TOPIC = "navigation";
const NAVIGATION_RENDER_REQUESTED_EVENT = "render-requested";
const NAVIGATION_PATH_REQUESTED_EVENT = "path-requested";
const NAVIGATION_POST_LOGIN_REDIRECT_CHANGED_EVENT = "post-login-redirect-changed";
const AUTH_TOPIC = "auth";
const AUTH_SESSION_CHANGED_EVENT = "session-changed";
const AUTH_LOGOUT_REQUESTED_EVENT = "logout-requested";

export {
  AUTH_LOGOUT_REQUESTED_EVENT,
  AUTH_SESSION_CHANGED_EVENT,
  AUTH_TOPIC,
  NAVIGATION_PATH_REQUESTED_EVENT,
  NAVIGATION_POST_LOGIN_REDIRECT_CHANGED_EVENT,
  NAVIGATION_RENDER_REQUESTED_EVENT,
  NAVIGATION_TOPIC,
};
