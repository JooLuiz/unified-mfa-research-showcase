/**
 * Maps shared contract names onto the ecommerce shell's window CustomEvents.
 * Role: The browser transport passed into shell, catalog, and related package factories.
 * Not in this file: Header element events' listeners (src/events/eventBus.js) or route rendering.
 * Key dependencies: @shared/shell-events; @shared/catalog-events; window CustomEvent.
 * See also: src/events/eventBus.js.
 */

import {
  AUTH_LOGOUT_REQUESTED_EVENT,
  AUTH_SESSION_CHANGED_EVENT,
  AUTH_TOPIC,
  RENDER_REQUESTED_EVENT,
  SHELL_TOPIC,
} from "@shared/shell-events";
import {
  CART_CHANGED_EVENT,
  CART_ITEM_ADD_REQUESTED_EVENT,
  CART_TOPIC,
} from "@shared/catalog-events";

const HOST_NAVIGATE_EVENT = "host:navigate";
const HOST_LOGOUT_EVENT = "host:logout";

const WINDOW_EVENT_BY_CONTRACT = {
  [`${AUTH_TOPIC}.${AUTH_SESSION_CHANGED_EVENT}`]: "auth:changed",
  [`${AUTH_TOPIC}.${AUTH_LOGOUT_REQUESTED_EVENT}`]: "auth:logout-request",
  [`${SHELL_TOPIC}.${RENDER_REQUESTED_EVENT}`]: "global:renderApp",
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

export { HOST_LOGOUT_EVENT, HOST_NAVIGATE_EVENT, createBrowserTransport };
