/**
 * Publishes and subscribes to ecommerce shell events.
 * Role: Joins window events with the Event Mesh client and exposes the shell transport.
 * Not in this file: Route rendering, cart mutation, or the command reply table (src/events/commandReplies.js).
 * Key dependencies: event-mesh/mesh; @shared/shell-events; @shared/catalog-events; @shared/checkout-events; @shared/account-events.
 * See also: src/main.js; src/events/commandReplies.js.
 */

import mesh from "event-mesh/mesh";
import { configureMesh } from "event-mesh/mesh";
import { createAccountEvents } from "@shared/account-events";
import {
  CART_CHANGED_EVENT,
  CART_ITEM_ADD_REQUESTED_EVENT,
  CART_TOPIC,
  CATALOG_TOPIC,
  createCatalogEvents,
  createPlpFiltersSnapshot,
} from "@shared/catalog-events";
import { createCheckoutEvents } from "@shared/checkout-events";
import { NOTIFICATION_RAISED_EVENT, NOTIFICATION_TOPIC } from "@shared/notifications";
import {
  AUTH_LOGOUT_REQUESTED_EVENT,
  AUTH_SESSION_CHANGED_EVENT,
  AUTH_TOPIC,
  NAVIGATION_TOPIC,
  NAVIGATION_RENDER_REQUESTED_EVENT,
  createShellEvents,
} from "@shared/shell-events";
import { MOCK_API_BASE_URL } from "../utils/constants";
import { CATALOG_FILTERS_CHANGED_EVENT } from "./eventContracts";
import { resolveSubscribeTarget, runMeshCommand } from "./commandReplies";

const HOST_NAVIGATE_EVENT = "host:navigate";
const HOST_LOGOUT_EVENT = "host:logout";

const WINDOW_EVENT_BY_CONTRACT = {
  [`${AUTH_TOPIC}.${AUTH_SESSION_CHANGED_EVENT}`]: "auth:changed",
  [`${AUTH_TOPIC}.${AUTH_LOGOUT_REQUESTED_EVENT}`]: "auth:logout-request",
  [`${NAVIGATION_TOPIC}.${NAVIGATION_RENDER_REQUESTED_EVENT}`]: "global:renderApp",
  [`${CART_TOPIC}.${CART_ITEM_ADD_REQUESTED_EVENT}`]: "cart:add-item",
  [`${CART_TOPIC}.${CART_CHANGED_EVENT}`]: "cart:updateGlobalCart",
  [`${NOTIFICATION_TOPIC}.${NOTIFICATION_RAISED_EVENT}`]: "ecommerce-shell:notification",
};

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

function createBrowserTransport() {
  function publish({ topic, event, payload }) {
    const eventName = WINDOW_EVENT_BY_CONTRACT[`${topic}.${event}`];
    if (!eventName) {
      return;
    }
    window.dispatchEvent(new CustomEvent(eventName, { detail: payload }));
  }

  function subscribe(topic, event, callback) {
    const eventName = WINDOW_EVENT_BY_CONTRACT[`${topic}.${event}`];
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

function composeShellBus(meshGateway) {
  function isWindowContract(topic, event) {
    return Boolean(WINDOW_EVENT_BY_CONTRACT[`${topic}.${event}`]);
  }

  return {
    publish(message) {
      if (isWindowContract(message.topic, message.event)) {
        browserTransport.publish(message);
        return;
      }
      meshGateway.publish(message);
    },
    subscribe(topic, event, callback) {
      if (isWindowContract(topic, event)) {
        return browserTransport.subscribe(topic, event, callback);
      }
      return meshGateway.subscribe(topic, event, callback);
    },
    request: meshGateway.request,
    whenConnected: meshGateway.whenConnected,
  };
}

/**
 * Builds the ecommerce event interface.
 *
 * @param {{ getAuthToken: () => string }} transportInput - Bearer token reader.
 * @returns {{ publish: Function, subscribe: Function, request: Function, whenConnected: Function }} Window bus plus mesh gateway.
 */
function createShellTransport({ getAuthToken }) {
  return composeShellBus(createMeshGateway({ getAuthToken }));
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
