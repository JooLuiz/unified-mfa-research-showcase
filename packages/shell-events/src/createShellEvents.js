/**
 * Publishes and subscribes to shell auth and render contracts.
 * Role: Exposes shell operations over an injected transport.
 * Not in this file: Header element events or the browser event-name map.
 * Key dependencies: src/shellEventsContracts.js.
 * See also: src/index.js.
 */

import {
  AUTH_LOGOUT_REQUESTED_EVENT,
  AUTH_SESSION_CHANGED_EVENT,
  AUTH_TOPIC,
  RENDER_REQUESTED_EVENT,
  SHELL_TOPIC,
} from "./shellEventsContracts.js";

/**
 * Creates shell event operations bound to a transport.
 *
 * @param {{ publish: (message: { topic: string, event: string, payload?: object, scope: string }) => void, subscribe: (topic: string, event: string, callback: (message: object) => void) => () => void }} transport - Branch transport.
 * @returns {{ publishRenderRequested: () => void, subscribeToRenderRequests: (listener: () => void) => () => void, publishAuthSessionChanged: () => void, subscribeToAuthSessionChanges: (listener: () => void) => () => void, publishLogoutRequested: () => void, subscribeToLogoutRequests: (listener: () => void) => () => void }} Shell event operations.
 */
function createShellEvents({ publish, subscribe }) {
  function publishRenderRequested() {
    publish({
      topic: SHELL_TOPIC,
      event: RENDER_REQUESTED_EVENT,
      scope: "local",
    });
  }

  function subscribeToRenderRequests(listener) {
    return subscribe(SHELL_TOPIC, RENDER_REQUESTED_EVENT, () => {
      listener();
    });
  }

  function publishAuthSessionChanged() {
    publish({
      topic: AUTH_TOPIC,
      event: AUTH_SESSION_CHANGED_EVENT,
      scope: "local",
    });
  }

  function subscribeToAuthSessionChanges(listener) {
    return subscribe(AUTH_TOPIC, AUTH_SESSION_CHANGED_EVENT, () => {
      listener();
    });
  }

  function publishLogoutRequested() {
    publish({
      topic: AUTH_TOPIC,
      event: AUTH_LOGOUT_REQUESTED_EVENT,
      scope: "local",
    });
  }

  function subscribeToLogoutRequests(listener) {
    return subscribe(AUTH_TOPIC, AUTH_LOGOUT_REQUESTED_EVENT, () => {
      listener();
    });
  }

  return {
    publishRenderRequested,
    subscribeToRenderRequests,
    publishAuthSessionChanged,
    subscribeToAuthSessionChanges,
    publishLogoutRequested,
    subscribeToLogoutRequests,
  };
}

export { createShellEvents };
