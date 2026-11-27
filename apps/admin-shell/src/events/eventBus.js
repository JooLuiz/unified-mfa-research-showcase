/**
 * Publishes and subscribes to admin shell window and header events.
 * Role: Maps shared shell and account contracts onto window CustomEvents and exposes the shell's publish and subscribe helpers.
 * Not in this file: Route rendering, auth storage, or notification toasts.
 * Key dependencies: @shared/shell-events; @shared/account-events; @shared/server-events page contracts;
 *   window CustomEvent.
 * See also: src/main.js; src/utils/mountActions.js.
 */

import { createAccountEvents } from "@shared/account-events";
import { NOTIFICATION_RAISED_EVENT, NOTIFICATION_TOPIC } from "@shared/notifications";
import {
  composeShellEvents,
  createServerEvents,
  isPageContract,
  pageEventName,
} from "@shared/server-events";
import {
  AUTH_LOGOUT_REQUESTED_EVENT,
  AUTH_SESSION_CHANGED_EVENT,
  AUTH_TOPIC,
  NAVIGATION_TOPIC,
  RENDER_REQUESTED_EVENT,
  createShellEvents,
} from "@shared/shell-events";
import { MOCK_API_BASE_URL } from "../utils/constants";
import { createAdminEndpoints } from "./eventEndpoints";

const HOST_NAVIGATE_EVENT = "host:navigate";
const HOST_LOGOUT_EVENT = "host:logout";

const WINDOW_EVENT_BY_CONTRACT = {
  [`${AUTH_TOPIC}.${AUTH_SESSION_CHANGED_EVENT}`]: "auth:changed",
  [`${AUTH_TOPIC}.${AUTH_LOGOUT_REQUESTED_EVENT}`]: "auth:logout-request",
  [`${NAVIGATION_TOPIC}.${RENDER_REQUESTED_EVENT}`]: "global:renderApp",
  [`${NOTIFICATION_TOPIC}.${NOTIFICATION_RAISED_EVENT}`]: "admin-shell:notification",
};

/**
 * Names the window event for a contract: a mapped shell event, or the in-page name remotes use.
 *
 * @param {string} topic - Contract topic.
 * @param {string} event - Contract event.
 * @returns {string | undefined} Window event name, or undefined for a server-only contract.
 */
function windowEventNameFor(topic, event) {
  const mappedName = WINDOW_EVENT_BY_CONTRACT[`${topic}.${event}`];
  if (mappedName) {
    return mappedName;
  }
  return isPageContract(topic, event) ? pageEventName(topic, event) : undefined;
}

/**
 * Creates a window CustomEvent transport for contract topic and event pairs.
 *
 * @returns {{ publish: (message: { topic: string, event: string, payload?: object, scope?: string }) => void, subscribe: (topic: string, event: string, callback: (message: { payload?: unknown }) => void) => () => void }} Browser transport.
 * @sideEffects Dispatches and listens for window CustomEvents.
 */
function createBrowserTransport() {
  function publish({ topic, event, payload }) {
    const eventName = windowEventNameFor(topic, event);
    if (!eventName) {
      return;
    }
    window.dispatchEvent(new CustomEvent(eventName, { detail: payload }));
  }

  function subscribe(topic, event, callback) {
    const eventName = windowEventNameFor(topic, event);
    if (!eventName) {
      return function unsubscribeUnmappedContract() {};
    }

    function handleWindowEvent(domEvent) {
      callback({ payload: domEvent.detail });
    }

    window.addEventListener(eventName, handleWindowEvent);
    return function unsubscribeFromWindowEvent() {
      window.removeEventListener(eventName, handleWindowEvent);
    };
  }

  return { publish, subscribe };
}

const browserTransport = createBrowserTransport();

let readAuthToken = () => "";

/**
 * Points the shell adapter at the live session token.
 *
 * @param {() => string | null | undefined} readToken - Reads the current bearer token.
 * @returns {void}
 */
function bindShellTransport(readToken) {
  readAuthToken = readToken;
}

/**
 * Builds the admin event interface.
 *
 * @param {{ getAuthToken: () => string }} transportInput - Bearer token reader.
 * @returns {{ publish: Function, subscribe: Function, request: Function, whenConnected: Function }} Window bus plus HTTP adapter.
 */
function createShellTransport({ getAuthToken }) {
  const serverEvents = createServerEvents({
    getApiBaseUrl: () => MOCK_API_BASE_URL,
    getAuthToken,
    endpoints: createAdminEndpoints(),
  });
  return composeShellEvents({
    browserTransport,
    serverEvents,
    isWindowContract(topic, event) {
      return Boolean(windowEventNameFor(topic, event));
    },
  });
}

const shellTransport = createShellTransport({
  getAuthToken: () => readAuthToken() || "",
});

const {
  publishRenderRequested,
  subscribeToRenderRequests,
  publishAuthSessionChanged,
  subscribeToAuthSessionChanges,
  publishLogoutRequested,
  subscribeToLogoutRequests,
} = createShellEvents(shellTransport);

const { ensureAccountIntentListeners, resetAccountIntentListeners } =
  createAccountEvents(shellTransport);

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

/**
 * Returns the session connection steps used by the shell's auth session lifecycle.
 * Window events and server requests need no connection, so each step does nothing here.
 *
 * @param {{ getConnectionTicket?: () => Promise<string> }} [_options] - Ticket source, unused here.
 * @returns {{ connectGuest: () => void, connectAuthenticated: () => void, disconnect: () => void }}
 *   Session channel for createAuthSessionLifecycle.
 */
function createShellSessionChannel(_options = {}) {
  return {
    connectGuest() {},
    connectAuthenticated() {},
    disconnect() {},
  };
}

export {
  createShellSessionChannel,
  bindShellTransport,
  createShellTransport,
  ensureAccountIntentListeners,
  publishAuthSessionChanged,
  publishLogoutRequested,
  publishRenderRequested,
  resetAccountIntentListeners,
  shellTransport,
  subscribeToAuthSessionChanges,
  subscribeToHeaderEvents,
  subscribeToLogoutRequests,
  subscribeToRenderRequests,
};
