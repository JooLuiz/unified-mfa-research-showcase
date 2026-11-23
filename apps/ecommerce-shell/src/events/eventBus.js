/**
 * Publishes and subscribes to ecommerce shell events.
 * Role: Wraps the Event Mesh client and exposes the shell transport.
 * Not in this file: Route rendering, cart mutation, or the shell command map (src/events/eventEndpoints.js).
 * Key dependencies: event-mesh/mesh; @shared/server-events; @shared/shell-events; @shared/catalog-events;
 *   @shared/checkout-events; @shared/account-events.
 * See also: src/main.js; src/events/eventEndpoints.js.
 */

import mesh from "event-mesh/mesh";
import { configureMesh } from "event-mesh/mesh";
import { createAccountEvents } from "@shared/account-events";
import {
  CART_CHANGED_EVENT,
  CART_TOPIC,
  CATALOG_TOPIC,
  createCatalogEvents,
  createPlpFiltersSnapshot,
} from "@shared/catalog-events";
import { createCheckoutEvents } from "@shared/checkout-events";
import { composeShellTransport, createServerEvents } from "@shared/server-events";
import { createShellEvents } from "@shared/shell-events";
import { MOCK_API_BASE_URL } from "../utils/constants";
import { CATALOG_FILTERS_CHANGED_EVENT } from "./eventContracts";
import { createEcommerceEndpoints } from "./eventEndpoints";

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

/**
 * Builds the ecommerce event interface.
 *
 * @param {{ getAuthToken: () => string }} transportInput - Bearer token reader.
 * @returns {import("@shared/server-events").ServerEventTransport} Gateway adapter over the mesh client.
 */
function createShellTransport({ getAuthToken }) {
  const serverEvents = createServerEvents({
    client: mesh,
    getApiBaseUrl: () => MOCK_API_BASE_URL,
    getAuthToken,
    endpoints: createEcommerceEndpoints(),
  });
  return composeShellTransport({ serverEvents });
}

let shellTransport = createShellTransport({
  getAuthToken: () => readAuthToken() || "",
});

/**
 * Replaces the shell event interface used by later stock calls.
 *
 * @param {{ publish: Function, subscribe: Function, request: Function, whenConnected: Function }} nextTransport - Transport read from the shellTransport binding on the next call.
 * @returns {void}
 * @sideEffects Assigns the shellTransport binding. Adapters created at startup keep the transport they already captured.
 */
function installShellTransport(nextTransport) {
  shellTransport = nextTransport;
}

const shellEvents = createShellEvents(shellTransport);
const catalogEvents = createCatalogEvents(shellTransport);
const checkoutEvents = createCheckoutEvents(shellTransport);
const accountEvents = createAccountEvents(shellTransport);
let cartChangedListenersStarted = false;

function publishPlpFiltersChanged(filters) {
  shellTransport.publish({
    topic: CATALOG_TOPIC,
    event: CATALOG_FILTERS_CHANGED_EVENT,
    payload: createPlpFiltersSnapshot(filters),
    scope: "local",
  });
}

function ensureCartEventListeners(handlers) {
  if (cartChangedListenersStarted) {
    return;
  }
  cartChangedListenersStarted = true;
  shellTransport.subscribe(CART_TOPIC, CART_CHANGED_EVENT, () => {
    handlers.onCartChanged();
  });
}

function resetCartEventListeners() {
  cartChangedListenersStarted = false;
}

function subscribeToCartItemAddRequests(listener) {
  return catalogEvents.subscribeToCartItemAddRequests((payload) => {
    listener({ detail: payload });
  });
}

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

const {
  publishCartItemAddRequested,
  publishCartChanged,
  subscribeToCartChanges,
  ensureCatalogIntentListeners,
  resetCatalogIntentListeners,
} = catalogEvents;

const {
  subscribeToCouponApplied,
  ensureCheckoutIntentListeners,
  resetCheckoutIntentListeners,
} = checkoutEvents;

const { ensureAccountIntentListeners, resetAccountIntentListeners } = accountEvents;

export {
  bindShellTransport,
  closeShellMesh,
  configureShellMesh,
  createShellTransport,
  ensureAccountIntentListeners,
  ensureCartEventListeners,
  ensureCatalogIntentListeners,
  ensureCheckoutIntentListeners,
  ensureShellEventListeners,
  installShellTransport,
  publishAuthSessionChanged,
  publishCartChanged,
  publishCartItemAddRequested,
  publishLogoutRequested,
  publishPostLoginRedirectChanged,
  publishPlpFiltersChanged,
  publishRenderRequested,
  resetAccountIntentListeners,
  resetCartEventListeners,
  resetCatalogIntentListeners,
  resetCheckoutIntentListeners,
  resetShellEventListeners,
  shellTransport,
  subscribeToAuthSessionChanges,
  subscribeToCartChanges,
  subscribeToCartItemAddRequests,
  subscribeToCouponApplied,
  subscribeToHeaderEvents,
  subscribeToLogoutRequests,
  subscribeToRenderRequests,
};
