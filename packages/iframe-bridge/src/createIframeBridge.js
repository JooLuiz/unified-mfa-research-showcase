/**
 * Publishes and subscribes to iframe bridge messages.
 * Role: Exposes resize and submit operations, and maps them onto postMessage on main.
 * Not in this file: Iframe DOM mounting or form field collection.
 * Key dependencies: src/iframeBridgeContracts.js; browser postMessage.
 * See also: src/index.js.
 */

import {
  FAQ_SUBMITTED_EVENT,
  GO_SHOPPING_EVENT,
  IFRAME_BRIDGE_TOPIC,
  POST_SUBMITTED_EVENT,
  RESIZED_EVENT,
} from "./iframeBridgeContracts.js";

const WINDOW_MESSAGE_TYPE_BY_EVENT = {
  [RESIZED_EVENT]: "iframe:resize",
  [FAQ_SUBMITTED_EVENT]: "faq:form-submitted",
  [POST_SUBMITTED_EVENT]: "post:form-submitted",
  [GO_SHOPPING_EVENT]: "checkout:go-shopping",
};

const EVENT_BY_WINDOW_MESSAGE_TYPE = Object.fromEntries(
  Object.entries(WINDOW_MESSAGE_TYPE_BY_EVENT).map(([eventName, messageType]) => [
    messageType,
    eventName,
  ]),
);

/**
 * Creates a postMessage transport that keeps the current host message shapes.
 *
 * @returns {{ publish: (message: { topic: string, event: string, payload?: object, scope?: string }) => void, subscribe: (topic: string, event: string, callback: (message: { payload?: unknown }) => void) => () => void }} Transport whose wire format is postMessage.
 * @sideEffects Posts messages to the parent window and listens on this window.
 */
function createPostMessageTransport() {
  function publish({ event, payload }) {
    const messageType = WINDOW_MESSAGE_TYPE_BY_EVENT[event];
    if (!messageType) {
      return;
    }
    const message = payload === undefined ? { type: messageType } : { type: messageType, payload };
    const targetWindow = window.parent === window ? window : window.parent;
    targetWindow.postMessage(message, "*");
  }

  function subscribe(_topic, event, callback) {
    function handleMessage(domEvent) {
      const messageData = domEvent.data;
      if (!messageData || typeof messageData !== "object") {
        return;
      }
      if (EVENT_BY_WINDOW_MESSAGE_TYPE[messageData.type] !== event) {
        return;
      }
      callback({ payload: messageData.payload });
    }

    window.addEventListener("message", handleMessage);
    return function unsubscribeFromIframeMessage() {
      window.removeEventListener("message", handleMessage);
    };
  }

  return { publish, subscribe };
}

/**
 * Creates iframe bridge operations bound to a transport.
 *
 * @param {{ publish: (message: { topic: string, event: string, payload?: object, scope: string }) => void, subscribe: (topic: string, event: string, callback: (message: { payload?: unknown }) => void) => () => void }} transport - Branch transport.
 * @returns {{ publishIframeMessage: (eventName: string, payload?: object) => void, subscribeToIframeEvent: (eventName: string, listener: (payload: unknown) => void) => () => void }} Iframe bridge operations.
 */
function createIframeBridge({ publish, subscribe }) {
  function publishIframeMessage(eventName, payload) {
    publish({
      topic: IFRAME_BRIDGE_TOPIC,
      event: eventName,
      payload,
      scope: "distributed",
    });
  }

  function subscribeToIframeEvent(eventName, listener) {
    return subscribe(IFRAME_BRIDGE_TOPIC, eventName, (message) => {
      listener(message.payload);
    });
  }

  return { publishIframeMessage, subscribeToIframeEvent };
}

export { createIframeBridge, createPostMessageTransport };
