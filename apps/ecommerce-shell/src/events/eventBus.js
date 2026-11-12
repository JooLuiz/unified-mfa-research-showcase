/**
 * Publishes and subscribes to ecommerce shell window, cart, and header events.
 * Role: Maps shared shell and catalog contracts onto window CustomEvents and exposes the shell's publish and subscribe helpers.
 * Not in this file: Route rendering, cart item mutation, auth storage, or notification toasts.
 * Key dependencies: @shared/shell-events; @shared/catalog-events; window CustomEvent.
 * See also: src/main.js; src/utils/cartActions.js; src/utils/mountActions.js.
 */

import {
  CART_CHANGED_EVENT,
  CART_ITEM_ADD_REQUESTED_EVENT,
  CART_TOPIC,
  createCatalogEvents,
} from "@shared/catalog-events";
import {
  AUTH_LOGOUT_REQUESTED_EVENT,
  AUTH_SESSION_CHANGED_EVENT,
  AUTH_TOPIC,
  NAVIGATION_TOPIC,
  RENDER_REQUESTED_EVENT,
  createShellEvents,
} from "@shared/shell-events";

const HOST_NAVIGATE_EVENT = "host:navigate";
const HOST_LOGOUT_EVENT = "host:logout";

const WINDOW_EVENT_BY_CONTRACT = {
  [`${AUTH_TOPIC}.${AUTH_SESSION_CHANGED_EVENT}`]: "auth:changed",
  [`${AUTH_TOPIC}.${AUTH_LOGOUT_REQUESTED_EVENT}`]: "auth:logout-request",
  [`${NAVIGATION_TOPIC}.${RENDER_REQUESTED_EVENT}`]: "global:renderApp",
  [`${CART_TOPIC}.${CART_ITEM_ADD_REQUESTED_EVENT}`]: "cart:add-item",
  [`${CART_TOPIC}.${CART_CHANGED_EVENT}`]: "cart:updateGlobalCart",
};

/**
 * Creates a window CustomEvent transport for contract topic and event pairs.
 *
 * @returns {{ publish: (message: { topic: string, event: string, payload?: object, scope?: string }) => void, subscribe: (topic: string, event: string, callback: (message: { payload?: unknown }) => void) => () => void }} Browser transport.
 * @sideEffects Dispatches and listens for window CustomEvents.
 */
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
const shellEvents = createShellEvents(browserTransport);
const catalogEvents = createCatalogEvents(browserTransport);

/**
 * Subscribes to add-to-cart requests and keeps the existing CustomEvent detail shape.
 *
 * @param {(event: { detail: object }) => void} listener - Callback that receives the event detail.
 * @returns {() => void} Removes the subscription.
 * @sideEffects Registers a window event listener through the catalog package.
 */
function subscribeToCartItemAddRequests(listener) {
  return catalogEvents.subscribeToCartItemAddRequests((payload) => {
    listener({ detail: payload });
  });
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

const {
  publishRenderRequested,
  subscribeToRenderRequests,
  publishAuthSessionChanged,
  subscribeToAuthSessionChanges,
  publishLogoutRequested,
  subscribeToLogoutRequests,
} = shellEvents;

const { publishCartItemAddRequested, publishCartChanged, subscribeToCartChanges } = catalogEvents;

export {
  publishAuthSessionChanged,
  publishCartChanged,
  publishCartItemAddRequested,
  publishLogoutRequested,
  publishRenderRequested,
  subscribeToAuthSessionChanges,
  subscribeToCartChanges,
  subscribeToCartItemAddRequests,
  subscribeToHeaderEvents,
  subscribeToLogoutRequests,
  subscribeToRenderRequests,
};
