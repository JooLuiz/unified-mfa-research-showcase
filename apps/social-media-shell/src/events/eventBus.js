/**
 * Publishes and subscribes to social shell window and header events.
 * Role: Thin caller of the shared shell package over the browser transport.
 * Not in this file: Route rendering, auth storage, or notification toasts.
 * Key dependencies: @shared/shell-events; src/events/browserTransport.js.
 * See also: src/main.js; src/utils/mountActions.js.
 */

import { createShellEvents } from "@shared/shell-events";
import {
  HOST_LOGOUT_EVENT,
  HOST_NAVIGATE_EVENT,
  createBrowserTransport,
} from "./browserTransport";

const {
  publishRenderRequested,
  subscribeToRenderRequests,
  publishAuthSessionChanged,
  subscribeToAuthSessionChanges,
  publishLogoutRequested,
  subscribeToLogoutRequests,
} = createShellEvents(createBrowserTransport());

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
  publishAuthSessionChanged,
  publishLogoutRequested,
  publishRenderRequested,
  subscribeToAuthSessionChanges,
  subscribeToHeaderEvents,
  subscribeToLogoutRequests,
  subscribeToRenderRequests,
};
