/**
 * Publishes and subscribes to ecommerce shell window, cart, and header events.
 * Role: Thin caller of the shared shell and catalog packages over the browser transport.
 * Not in this file: Route rendering, cart item mutation, auth storage, or notification toasts.
 * Key dependencies: @shared/shell-events; @shared/catalog-events; src/events/browserTransport.js.
 * See also: src/main.js; src/utils/cartActions.js; src/utils/mountActions.js.
 */

import { createCatalogEvents } from "@shared/catalog-events";
import { createShellEvents } from "@shared/shell-events";
import {
  HOST_LOGOUT_EVENT,
  HOST_NAVIGATE_EVENT,
  createBrowserTransport,
} from "./browserTransport";

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
