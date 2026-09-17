/**
 * Publishes and subscribes to shared shell-local Event Mesh messages.
 * Role: Hides mesh transport details behind named auth/navigation operations and lifecycle-safe subscriptions.
 * Not in this file: Mesh configuration, authentication state, cart state, routing, or UI rendering.
 * Key dependencies: An Event Mesh client supplied by the owning shell.
 * See also: src/shellEventContracts.js.
 */

import {
  AUTH_LOGOUT_REQUESTED_EVENT,
  AUTH_SESSION_CHANGED_EVENT,
  AUTH_TOPIC,
  NAVIGATION_PATH_REQUESTED_EVENT,
  NAVIGATION_POST_LOGIN_REDIRECT_CHANGED_EVENT,
  NAVIGATION_RENDER_REQUESTED_EVENT,
  NAVIGATION_TOPIC,
} from "./shellEventContracts.js";

function isValidNavigationPath(path) {
  return typeof path === "string" && path.trim() !== "";
}

/**
 * Creates a shell-scoped local event adapter for auth and navigation messages.
 *
 * @param {{ mesh: { publish: (input: object) => void, subscribe: (topic: string, event: string, callback: (message: object) => void) => () => void } }} adapterInput - Configured mesh client for the owning shell.
 * @returns {{ publishRenderRequested: () => void, publishPathRequested: (path: string) => void, publishPostLoginRedirectChanged: (path: string | null) => void, publishAuthSessionChanged: () => void, publishLogoutRequested: () => void, ensureShellEventListeners: (handlers: object) => void, resetShellEventListeners: () => void, subscribeToAuthSessionChanges: (listener: () => void) => () => void }} Shell event adapter.
 */
function createShellEvents({ mesh }) {
  let shellEventListenersStarted = false;
  const authSessionListeners = new Set();

  function publishLocalEvent(topic, event, payload = {}) {
    mesh.publish({ topic, event, payload, scope: "local" });
  }

  /**
   * Publishes a request to rerender the shell at its current route.
   *
   * @returns {void}
   * @sideEffects Publishes a local navigation.render-requested message.
   */
  function publishRenderRequested() {
    publishLocalEvent(NAVIGATION_TOPIC, NAVIGATION_RENDER_REQUESTED_EVENT);
  }

  /**
   * Publishes a request to navigate the shell to a specific path.
   *
   * @param {string} path - Relative application path, including optional query parameters.
   * @returns {void}
   * @sideEffects Publishes a local navigation.path-requested message when the path is valid.
   */
  function publishPathRequested(path) {
    if (!isValidNavigationPath(path)) {
      return;
    }

    publishLocalEvent(NAVIGATION_TOPIC, NAVIGATION_PATH_REQUESTED_EVENT, {
      path,
    });
  }

  /**
   * Publishes that the post-login redirect intent changed (set or cleared).
   *
   * @param {string | null} path - Relative path to remember, or null when consumed/cleared.
   * @returns {void}
   * @sideEffects Publishes a local navigation.post-login-redirect-changed message.
   * @note sessionStorage remains the reload/tab cache; this event is live coordination only.
   */
  function publishPostLoginRedirectChanged(path) {
    if (path === null || path === undefined) {
      publishLocalEvent(
        NAVIGATION_TOPIC,
        NAVIGATION_POST_LOGIN_REDIRECT_CHANGED_EVENT,
        { path: null },
      );
      return;
    }

    if (!isValidNavigationPath(path)) {
      return;
    }

    publishLocalEvent(
      NAVIGATION_TOPIC,
      NAVIGATION_POST_LOGIN_REDIRECT_CHANGED_EVENT,
      { path },
    );
  }

  /**
   * Publishes that the stored authentication session has changed.
   *
   * @returns {void}
   * @sideEffects Publishes a local auth.session-changed message.
   */
  function publishAuthSessionChanged() {
    publishLocalEvent(AUTH_TOPIC, AUTH_SESSION_CHANGED_EVENT);
  }

  /**
   * Publishes a request to clear the current authentication session.
   *
   * @returns {void}
   * @sideEffects Publishes a local auth.logout-requested message.
   */
  function publishLogoutRequested() {
    publishLocalEvent(AUTH_TOPIC, AUTH_LOGOUT_REQUESTED_EVENT);
  }

  /**
   * Registers persistent shell-level handlers after a mesh configuration change.
   *
   * @param {{ onRenderRequested: () => void, onPathRequested: (payload: { path: string }) => void, onAuthSessionChanged: () => void, onLogoutRequested: () => void }} handlers - Shell orchestration handlers.
   * @returns {void}
   * @sideEffects Registers four local mesh subscriptions.
   */
  function ensureShellEventListeners(handlers) {
    if (shellEventListenersStarted) {
      return;
    }

    shellEventListenersStarted = true;
    mesh.subscribe(NAVIGATION_TOPIC, NAVIGATION_RENDER_REQUESTED_EVENT, () => {
      handlers.onRenderRequested();
    });
    mesh.subscribe(NAVIGATION_TOPIC, NAVIGATION_PATH_REQUESTED_EVENT, (message) => {
      const requestedPath = message.payload?.path;
      if (isValidNavigationPath(requestedPath)) {
        handlers.onPathRequested({ path: requestedPath });
      }
    });
    mesh.subscribe(AUTH_TOPIC, AUTH_SESSION_CHANGED_EVENT, () => {
      authSessionListeners.forEach((listener) => listener());
      handlers.onAuthSessionChanged();
    });
    mesh.subscribe(AUTH_TOPIC, AUTH_LOGOUT_REQUESTED_EVENT, () => {
      handlers.onLogoutRequested();
    });
  }

  /**
   * Marks shell subscriptions for re-registration after mesh.close() clears them.
   *
   * @returns {void}
   */
  function resetShellEventListeners() {
    shellEventListenersStarted = false;
  }

  /**
   * Registers a UI observer without exposing Event Mesh to the mounted module.
   *
   * @param {() => void} listener - Callback invoked for each auth session change.
   * @returns {() => void} Removes the observer from the shell-managed registry.
   * @sideEffects Mutates the adapter's auth observer registry.
   */
  function subscribeToAuthSessionChanges(listener) {
    authSessionListeners.add(listener);

    return () => {
      authSessionListeners.delete(listener);
    };
  }

  return {
    publishRenderRequested,
    publishPathRequested,
    publishPostLoginRedirectChanged,
    publishAuthSessionChanged,
    publishLogoutRequested,
    ensureShellEventListeners,
    resetShellEventListeners,
    subscribeToAuthSessionChanges,
  };
}

export { createShellEvents };
