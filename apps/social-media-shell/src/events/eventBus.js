/**
 * Publishes and subscribes to social shell events.
 * Role: Wraps the Event Mesh client and exposes the shell transport.
 * Not in this file: Route rendering or the command reply table (src/events/commandReplies.js).
 * Key dependencies: event-mesh/mesh; @shared/shell-events; @shared/catalog-events; @shared/account-events; @shared/community-events.
 * See also: src/main.js; src/events/commandReplies.js.
 */

import mesh from "event-mesh/mesh";
import { configureMesh } from "event-mesh/mesh";
import { createAccountEvents } from "@shared/account-events";
import { createCatalogEvents } from "@shared/catalog-events";
import { createCommunityEvents } from "@shared/community-events";
import { createShellEvents } from "@shared/shell-events";
import { MOCK_API_BASE_URL } from "../utils/constants";
import { resolveSubscribeTarget, runMeshCommand } from "./commandReplies";

const HOST_NAVIGATE_EVENT = "host:navigate";
const HOST_LOGOUT_EVENT = "host:logout";

/**
 * Configures the shell's Event Mesh connection.
 *
 * @param {object} meshOptions - Options forwarded to configureMesh.
 * @returns {void}
 * @sideEffects Configures the shared mesh client. Call this before the first publish or subscribe.
 */
function configureShellMesh(meshOptions) {
  configureMesh(meshOptions);
}

/**
 * Closes the shell's Event Mesh connection.
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

function createMeshGateway({ getAuthToken }) {
  return {
    publish(message) {
      mesh.publish(message);
    },
    subscribe(topic, event, callback) {
      const target = resolveSubscribeTarget(topic, event);
      return mesh.subscribe(target.topic, target.event, callback);
    },
    request({ topic, event, payload }) {
      return runMeshCommand({
        mesh,
        getAuthToken,
        apiBaseUrl: MOCK_API_BASE_URL,
        topic,
        event,
        payload,
      });
    },
    whenConnected(options) {
      return mesh.whenConnected(options);
    },
  };
}

/**
 * Builds the social event interface.
 *
 * @param {{ getAuthToken: () => string }} transportInput - Bearer token reader.
 * @returns {{ publish: Function, subscribe: Function, request: Function, whenConnected: Function }} Mesh gateway.
 */
function createShellTransport({ getAuthToken }) {
  return createMeshGateway({ getAuthToken });
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
const catalogEvents = createCatalogEvents(shellTransport);
const accountEvents = createAccountEvents(shellTransport);
const communityEvents = createCommunityEvents(shellTransport);

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

const { ensureCatalogIntentListeners, resetCatalogIntentListeners } = catalogEvents;
const { ensureAccountIntentListeners, resetAccountIntentListeners } = accountEvents;
const { ensureCommunityIntentListeners, resetCommunityIntentListeners } = communityEvents;

export {
  bindShellTransport,
  closeShellMesh,
  configureShellMesh,
  createShellTransport,
  ensureAccountIntentListeners,
  ensureCatalogIntentListeners,
  ensureCommunityIntentListeners,
  ensureShellEventListeners,
  installShellTransport,
  publishAuthSessionChanged,
  publishLogoutRequested,
  publishPostLoginRedirectChanged,
  publishRenderRequested,
  resetAccountIntentListeners,
  resetCatalogIntentListeners,
  resetCommunityIntentListeners,
  resetShellEventListeners,
  shellTransport,
  subscribeToAuthSessionChanges,
  subscribeToHeaderEvents,
  subscribeToLogoutRequests,
  subscribeToRenderRequests,
};
