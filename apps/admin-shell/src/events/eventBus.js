/**
 * Publishes and subscribes to admin shell events.
 * Role: Wraps the Event Mesh client and exposes the shell transport.
 * Not in this file: Route rendering or the shell command map (src/events/eventEndpoints.js).
 * Key dependencies: event-mesh/mesh; @shared/server-events; @shared/shell-events; @shared/account-events.
 * See also: src/main.js; src/events/eventEndpoints.js.
 */

import mesh from "event-mesh/mesh";
import { configureMesh } from "event-mesh/mesh";
import { createAccountEvents } from "@shared/account-events";
import { composeShellEvents, createServerEvents } from "@shared/server-events";
import { createShellEvents } from "@shared/shell-events";
import { MOCK_API_BASE_URL } from "../utils/constants";
import { createAdminEndpoints } from "./eventEndpoints";

const HOST_NAVIGATE_EVENT = "host:navigate";
const HOST_LOGOUT_EVENT = "host:logout";

/**
 * Configures the shell Event Mesh connection.
 *
 * @param {object} meshOptions - Options forwarded to configureMesh.
 * @returns {void}
 * @sideEffects Configures the shared mesh client. Call this before the first publish or subscribe.
 */
function configureShellMesh(meshOptions) {
  configureMesh(meshOptions);
}

/**
 * Closes the shell Event Mesh connection.
 *
 * @returns {void}
 * @sideEffects Closes the shared mesh client and drops its subscriptions.
 */
function closeShellMesh() {
  mesh.close();
}

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
 * @returns {import("@shared/server-events").ServerEventTransport} Gateway adapter over the mesh client.
 */
function createShellTransport({ getAuthToken }) {
  const serverEvents = createServerEvents({
    client: mesh,
    getApiBaseUrl: () => MOCK_API_BASE_URL,
    getAuthToken,
    endpoints: createAdminEndpoints(),
  });
  const composedEvents = composeShellEvents({ serverEvents });
  // Mesh-only 401 backstop. A write the gateway does not serve still goes over HTTP; when it
  // replies "unauthorized", the live session/revoked push may have missed this tab (socket down),
  // so request a local logout. main has no backstop: its revoke stream is the only path.
  async function requestWithLogoutBackstop(message) {
    const outcome = await composedEvents.request(message);
    if (outcome && outcome.ok === false && outcome.code === "unauthorized") {
      publishLogoutRequested();
    }
    return outcome;
  }
  return { ...composedEvents, request: requestWithLogoutBackstop };
}

let shellTransport = createShellTransport({
  getAuthToken: () => readAuthToken() || "",
});

/**
 * Replaces the shell event interface used by later calls.
 *
 * @param {{ publish: Function, subscribe: Function, request: Function, whenConnected: Function }} nextTransport - Transport read from the shellTransport binding on the next call.
 * @returns {void}
 * @sideEffects Assigns the shellTransport binding.
 */
function installShellTransport(nextTransport) {
  shellTransport = nextTransport;
}

const shellEvents = createShellEvents(shellTransport);
const accountEvents = createAccountEvents(shellTransport);

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

const {
  publishRenderRequested,
  subscribeToRenderRequests,
  publishAuthSessionChanged,
  subscribeToAuthSessionChanges,
  publishLogoutRequested,
  publishPostLoginRedirectChanged,
  subscribeToLogoutRequests,
  ensureShellEventListeners,
  resetShellEventListeners,
} = shellEvents;

const { ensureAccountIntentListeners, resetAccountIntentListeners } = accountEvents;

export {
  bindShellTransport,
  closeShellMesh,
  configureShellMesh,
  createShellTransport,
  ensureAccountIntentListeners,
  ensureShellEventListeners,
  installShellTransport,
  publishAuthSessionChanged,
  publishLogoutRequested,
  publishPostLoginRedirectChanged,
  publishRenderRequested,
  resetAccountIntentListeners,
  resetShellEventListeners,
  shellTransport,
  subscribeToAuthSessionChanges,
  subscribeToHeaderEvents,
  subscribeToLogoutRequests,
  subscribeToRenderRequests,
};
