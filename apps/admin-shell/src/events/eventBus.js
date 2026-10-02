/**
 * Publishes and subscribes to admin shell window and header events.
 * Role: The only admin-shell module that dispatches CustomEvents or listens for header element events.
 * Not in this file: Route rendering, auth storage, or notification toasts.
 * Key dependencies: src/events/eventContracts.js; window CustomEvent.
 * See also: src/main.js; src/utils/mountActions.js.
 */

import {
  AUTH_CHANGED_EVENT,
  AUTH_LOGOUT_REQUEST_EVENT,
  HOST_LOGOUT_EVENT,
  HOST_NAVIGATE_EVENT,
  RENDER_APP_EVENT,
} from "./eventContracts";

/**
 * Asks the shell to render the current URL.
 *
 * @returns {void}
 * @sideEffects Dispatches the render CustomEvent on window.
 */
function publishRenderRequested() {
  window.dispatchEvent(new CustomEvent(RENDER_APP_EVENT));
}

/**
 * Subscribes to shell render requests.
 *
 * @param {() => void} listener - Callback invoked when a render is requested.
 * @returns {() => void} Removes the subscription.
 * @sideEffects Registers a window event listener.
 */
function subscribeToRenderRequests(listener) {
  window.addEventListener(RENDER_APP_EVENT, listener);
  return function unsubscribeFromRenderRequests() {
    window.removeEventListener(RENDER_APP_EVENT, listener);
  };
}

/**
 * Announces that the authenticated session changed.
 *
 * @returns {void}
 * @sideEffects Dispatches the auth-changed CustomEvent on window.
 */
function publishAuthSessionChanged() {
  window.dispatchEvent(new CustomEvent(AUTH_CHANGED_EVENT));
}

/**
 * Subscribes to authenticated session changes.
 *
 * @param {() => void} listener - Callback invoked after login, logout, or profile refresh.
 * @returns {() => void} Removes the subscription.
 * @sideEffects Registers a window event listener.
 */
function subscribeToAuthSessionChanges(listener) {
  window.addEventListener(AUTH_CHANGED_EVENT, listener);
  return function unsubscribeFromAuthSessionChanges() {
    window.removeEventListener(AUTH_CHANGED_EVENT, listener);
  };
}

/**
 * Asks the shell to log the current user out.
 *
 * @returns {void}
 * @sideEffects Dispatches the logout-request CustomEvent on window.
 */
function publishLogoutRequested() {
  window.dispatchEvent(new CustomEvent(AUTH_LOGOUT_REQUEST_EVENT));
}

/**
 * Subscribes to logout requests.
 *
 * @param {() => void} listener - Callback that clears the session and navigates.
 * @returns {() => void} Removes the subscription.
 * @sideEffects Registers a window event listener.
 */
function subscribeToLogoutRequests(listener) {
  window.addEventListener(AUTH_LOGOUT_REQUEST_EVENT, listener);
  return function unsubscribeFromLogoutRequests() {
    window.removeEventListener(AUTH_LOGOUT_REQUEST_EVENT, listener);
  };
}

/**
 * Listens for header navigation and logout events on a mounted header element.
 *
 * @param {EventTarget} headerElement - Header custom element.
 * @param {{ onNavigate: (event: Event) => void, onLogout: () => void }} handlers - Header outcomes.
 * @returns {() => void} Removes both header listeners.
 * @sideEffects Registers element event listeners.
 */
function subscribeToHeaderEvents(headerElement, handlers) {
  const handleNavigate = (event) => {
    handlers.onNavigate(event);
  };
  const handleLogout = () => {
    handlers.onLogout();
  };

  headerElement.addEventListener(HOST_NAVIGATE_EVENT, handleNavigate);
  headerElement.addEventListener(HOST_LOGOUT_EVENT, handleLogout);

  return function unsubscribeFromHeaderEvents() {
    headerElement.removeEventListener(HOST_NAVIGATE_EVENT, handleNavigate);
    headerElement.removeEventListener(HOST_LOGOUT_EVENT, handleLogout);
  };
}

export {
  publishRenderRequested,
  subscribeToRenderRequests,
  publishAuthSessionChanged,
  subscribeToAuthSessionChanges,
  publishLogoutRequested,
  subscribeToLogoutRequests,
  subscribeToHeaderEvents,
};
