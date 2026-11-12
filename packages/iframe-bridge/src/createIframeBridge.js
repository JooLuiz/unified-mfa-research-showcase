/**
 * Publishes and subscribes to distributed iframe-bridge messages.
 * Role: Adapts either a configured Event Mesh client or an injected transport to iframe messages.
 * Not in this file: Mesh configuration, gateway relay persistence, iframe DOM creation, or postMessage.
 * Key dependencies: An Event Mesh client supplied by the parent shell or iframe, or a recording transport in tests.
 * See also: src/iframeBridgeContracts.js; src/index.js; apps/mock-data-service/src/inbound/iframeBridgeHandler.js.
 */

import {
  IFRAME_BRIDGE_MESSAGE_EVENT,
  IFRAME_BRIDGE_TOPIC,
} from "./iframeBridgeContracts.js";

const IFRAME_CHANNEL_REGISTERED_EVENT = "registered";
const IFRAME_CHANNEL_UNREGISTERED_EVENT = "unregistered";
const IFRAME_MESSAGE_EVENT = IFRAME_BRIDGE_MESSAGE_EVENT;

function isValidChannelId(channelId) {
  return typeof channelId === "string" && /^[a-z0-9-]{36}$/.test(channelId);
}

function isValidFrameId(frameId) {
  return (
    frameId === "faq-formulary" ||
    frameId === "new-post-formulary" ||
    frameId === "checkout-empty"
  );
}

function isBridgeMessage(payload) {
  return (
    payload &&
    typeof payload === "object" &&
    isValidChannelId(payload.channelId) &&
    isValidFrameId(payload.frameId) &&
    typeof payload.event === "string"
  );
}

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
 * Creates a random opaque correlation ID for one parent/iframe relationship.
 *
 * @returns {string} UUID channel ID.
 */
function createIframeChannel() {
  return crypto.randomUUID();
}

/**
 * Creates channel registration and action delivery on one publish/subscribe transport.
 *
 * @param {{ publish: (message: { topic: string, event: string, payload?: object, scope: string }) => void, subscribe: (topic: string, event: string, callback: (message: { payload?: unknown }) => void) => () => void }} transport - Mesh client or recording transport. Both expose publish and subscribe.
 * @returns {{ registerIframeChannel: (input: { channelId: string, frameId: string }) => void, unregisterIframeChannel: (input: { channelId: string, frameId: string }) => void, publishIframeMessage: (eventOrChannel: string | { channelId: string, frameId: string, event: string, payload?: object }, payload?: object) => void, subscribeToIframeChannel: (input: { channelId: string, frameId: string, onMessage: (message: { event: string, payload: object }) => void }) => () => void, subscribeToIframeEvent: (eventName: string, listener: (payload: unknown) => void) => () => void }} Bridge API.
 * @sideEffects Publishes iframe-bridge messages. A string first argument publishes the action envelope; an object publishes the channel payload.
 */
function createIframeBridge(transport) {
  function registerIframeChannel({ channelId, frameId }) {
    if (!isValidChannelId(channelId) || !isValidFrameId(frameId)) {
      return;
    }

    transport.publish({
      topic: IFRAME_BRIDGE_TOPIC,
      event: IFRAME_CHANNEL_REGISTERED_EVENT,
      payload: { channelId, frameId },
      scope: "distributed",
    });
  }

  function unregisterIframeChannel({ channelId, frameId }) {
    if (!isValidChannelId(channelId) || !isValidFrameId(frameId)) {
      return;
    }

    transport.publish({
      topic: IFRAME_BRIDGE_TOPIC,
      event: IFRAME_CHANNEL_UNREGISTERED_EVENT,
      payload: { channelId, frameId },
      scope: "distributed",
    });
  }

  function publishChannelMessage({ channelId, frameId, event, payload = {} }) {
    if (
      !isValidChannelId(channelId) ||
      !isValidFrameId(frameId) ||
      typeof event !== "string"
    ) {
      return;
    }

    transport.publish({
      topic: IFRAME_BRIDGE_TOPIC,
      event: IFRAME_MESSAGE_EVENT,
      payload: { channelId, frameId, event, payload },
      scope: "distributed",
    });
  }

  function publishActionMessage(eventName, payload) {
    transport.publish({
      topic: IFRAME_BRIDGE_TOPIC,
      event: IFRAME_BRIDGE_MESSAGE_EVENT,
      payload: { event: eventName, payload },
      scope: "distributed",
    });
  }

  /**
   * Publishes an iframe message. A string is an action name; an object is a channel message.
   *
   * @param {string | { channelId: string, frameId: string, event: string, payload?: object }} eventOrChannel - Action name, or the channel message.
   * @param {object} [payload] - Inner payload when the first argument is an action name.
   * @returns {void}
   * @sideEffects Publishes an iframe-bridge message event.
   */
  function publishIframeMessage(eventOrChannel, payload) {
    if (typeof eventOrChannel === "string") {
      publishActionMessage(eventOrChannel, payload);
      return;
    }
    publishChannelMessage(eventOrChannel);
  }

  function subscribeToIframeChannel({ channelId, frameId, onMessage }) {
    return transport.subscribe(IFRAME_BRIDGE_TOPIC, IFRAME_MESSAGE_EVENT, (message) => {
      const bridgeMessage = message.payload;
      if (
        !isBridgeMessage(bridgeMessage) ||
        bridgeMessage.channelId !== channelId ||
        bridgeMessage.frameId !== frameId
      ) {
        return;
      }

      onMessage({
        event: bridgeMessage.event,
        payload: bridgeMessage.payload,
      });
    });
  }

  function subscribeToIframeEvent(eventName, listener) {
    return transport.subscribe(IFRAME_BRIDGE_TOPIC, IFRAME_BRIDGE_MESSAGE_EVENT, (message) => {
      if (readBridgeAction(message.payload) !== eventName) {
        return;
      }
      listener(readBridgeInnerPayload(message.payload));
    });
  }

  return {
    registerIframeChannel,
    unregisterIframeChannel,
    publishIframeMessage,
    subscribeToIframeChannel,
    subscribeToIframeEvent,
  };
}

export {
  IFRAME_BRIDGE_TOPIC,
  IFRAME_CHANNEL_REGISTERED_EVENT,
  IFRAME_CHANNEL_UNREGISTERED_EVENT,
  IFRAME_MESSAGE_EVENT,
  createIframeBridge,
  createIframeChannel,
};
