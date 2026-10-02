/**
 * Names the social shell window and header events.
 * Role: Holds the event name strings the social shell bus publishes and subscribes to.
 * Not in this file: Publishing, subscribing, or payload checks (src/events/eventBus.js).
 * Key dependencies: None.
 * See also: src/events/eventBus.js.
 */

const RENDER_APP_EVENT = "global:renderApp";
const AUTH_CHANGED_EVENT = "auth:changed";
const AUTH_LOGOUT_REQUEST_EVENT = "auth:logout-request";
const HOST_NAVIGATE_EVENT = "host:navigate";
const HOST_LOGOUT_EVENT = "host:logout";

export {
  RENDER_APP_EVENT,
  AUTH_CHANGED_EVENT,
  AUTH_LOGOUT_REQUEST_EVENT,
  HOST_NAVIGATE_EVENT,
  HOST_LOGOUT_EVENT,
};
