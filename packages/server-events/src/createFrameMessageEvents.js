/**
 * Creates the window message channel used by iframe-bridge.
 * Role: postMessage wire format for iframe-bridge messages.
 * Not in this file: Bridge operations (packages/iframe-bridge/src/createIframeBridge.js) or iframe DOM mounting.
 * Key dependencies: @shared/iframe-bridge event-name constants; browser postMessage.
 * See also: src/index.js; packages/iframe-bridge/src/createIframeBridge.js.
 *   On mesh this is the same-origin fallback; cross-origin frames use the Event Mesh client.
 */

import {
  FAQ_SUBMITTED_EVENT,
  GO_SHOPPING_EVENT,
  IFRAME_BRIDGE_MESSAGE_EVENT,
  POST_SUBMITTED_EVENT,
  RESIZED_EVENT,
} from "@shared/iframe-bridge";

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
 * Reads the action name from an iframe-bridge message payload.
 *
 * @param {unknown} payload - Payload published for the message event.
 * @returns {string | undefined} Action name when the payload carries one.
 */
function readBridgeAction(payload) {
  if (!payload || typeof payload !== "object" || !("event" in payload)) {
    return undefined;
  }
  const action = payload.event;
  return typeof action === "string" ? action : undefined;
}

/**
 * Reads the caller payload stored inside an iframe-bridge message payload.
 *
 * @param {unknown} payload - Payload published for the message event.
 * @returns {unknown} Inner payload, or undefined when the message has none.
 */
function readBridgeInnerPayload(payload) {
  if (!payload || typeof payload !== "object" || !("payload" in payload)) {
    return undefined;
  }
  return payload.payload;
}

/**
 * Creates a window message channel that keeps the current host message shapes.
 *
 * @returns {{ publish: (message: { topic: string, event: string, payload?: object, scope?: string }) => void, subscribe: (topic: string, event: string, callback: (message: { payload?: unknown }) => void) => () => void }} Channel whose wire format is postMessage.
 * @sideEffects Posts messages to the parent window and listens on this window.
 */
function createFrameMessageEvents() {
  function publish({ event, payload }) {
    if (event !== IFRAME_BRIDGE_MESSAGE_EVENT) {
      return;
    }
    const messageType = WINDOW_MESSAGE_TYPE_BY_EVENT[readBridgeAction(payload)];
    if (!messageType) {
      return;
    }
    const innerPayload = readBridgeInnerPayload(payload);
    const message =
      innerPayload === undefined ? { type: messageType } : { type: messageType, payload: innerPayload };
    const targetWindow = window.parent === window ? window : window.parent;
    targetWindow.postMessage(message, "*");
  }

  function subscribe(_topic, event, callback) {
    if (event !== IFRAME_BRIDGE_MESSAGE_EVENT) {
      return function unsubscribeUnmappedIframeMessage() {};
    }

    function handleMessage(domEvent) {
      const messageData = domEvent.data;
      if (!messageData || typeof messageData !== "object") {
        return;
      }
      const action = EVENT_BY_WINDOW_MESSAGE_TYPE[messageData.type];
      if (!action) {
        return;
      }
      callback({ payload: { event: action, payload: messageData.payload } });
    }

    window.addEventListener("message", handleMessage);
    return function unsubscribeFromIframeMessage() {
      window.removeEventListener("message", handleMessage);
    };
  }

  return { publish, subscribe };
}

export { createFrameMessageEvents };
