/**
 * Publishes and subscribes to iframe bridge messages.
 * Role: Publishes iframe actions as iframe-bridge message events on an injected transport.
 * Not in this file: The postMessage wire format (packages/server-events/src/createFrameMessageEvents.js),
 *   iframe DOM mounting, or form field collection.
 * Key dependencies: src/iframeBridgeContracts.js; an injected transport.
 * See also: src/index.js.
 */

import { IFRAME_BRIDGE_MESSAGE_EVENT, IFRAME_BRIDGE_TOPIC } from "./iframeBridgeContracts.js";

/**
 * Reads the action name from an iframe-bridge message payload.
 *
 * @param {unknown} payload - Transport payload published for the message event.
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
 * @param {unknown} payload - Transport payload published for the message event.
 * @returns {unknown} Inner payload, or undefined when the message has none.
 */
function readBridgeInnerPayload(payload) {
  if (!payload || typeof payload !== "object" || !("payload" in payload)) {
    return undefined;
  }
  return payload.payload;
}

/**
 * Creates iframe bridge operations bound to a transport.
 *
 * @param {{ publish: (message: { topic: string, event: string, payload?: object, scope: string }) => void, subscribe: (topic: string, event: string, callback: (message: { payload?: unknown }) => void) => () => void }} transport - Branch transport.
 * @returns {{ publishIframeMessage: (eventName: string, payload?: object) => void, subscribeToIframeEvent: (eventName: string, listener: (payload: unknown) => void) => () => void }} Iframe bridge operations.
 * @sideEffects Publishes iframe-bridge message events. The action name is stored on the payload.
 */
function createIframeBridge({ publish, subscribe }) {
  function publishIframeMessage(eventName, payload) {
    publish({
      topic: IFRAME_BRIDGE_TOPIC,
      event: IFRAME_BRIDGE_MESSAGE_EVENT,
      payload: { event: eventName, payload },
      scope: "distributed",
    });
  }

  function subscribeToIframeEvent(eventName, listener) {
    return subscribe(IFRAME_BRIDGE_TOPIC, IFRAME_BRIDGE_MESSAGE_EVENT, (message) => {
      if (readBridgeAction(message.payload) !== eventName) {
        return;
      }
      listener(readBridgeInnerPayload(message.payload));
    });
  }

  return { publishIframeMessage, subscribeToIframeEvent };
}

export { createIframeBridge };
