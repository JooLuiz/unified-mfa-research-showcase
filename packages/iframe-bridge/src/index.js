/**
 * Provides shared distributed Event Mesh helpers for cross-origin iframe bridges.
 * Role: Creates channel identifiers, validates bridge envelopes, and adapts mesh publication/subscription.
 * Not in this file: Mesh configuration, gateway relay persistence, iframe DOM creation, or page-specific behavior.
 * Key dependencies: A configured Event Mesh client supplied by the parent shell or iframe.
 * See also: apps/mock-data-service/src/event-mesh/iframeBridgeHandler.js.
 */

const IFRAME_BRIDGE_TOPIC = "iframe-bridge";
const IFRAME_CHANNEL_REGISTERED_EVENT = "registered";
const IFRAME_CHANNEL_UNREGISTERED_EVENT = "unregistered";
const IFRAME_MESSAGE_EVENT = "message";

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
 * Creates a random opaque correlation ID for one parent/iframe relationship.
 *
 * @returns {string} UUID channel ID.
 */
function createIframeChannel() {
  return crypto.randomUUID();
}

/**
 * Creates the bridge interface around a configured Event Mesh client.
 *
 * @param {{ mesh: { publish: (input: object) => void, subscribe: (topic: string, event: string, callback: (message: object) => void) => () => void } }} adapterInput - Mesh client used by this browsing context.
 * @returns {{ registerIframeChannel: (input: { channelId: string, frameId: string }) => void, unregisterIframeChannel: (input: { channelId: string, frameId: string }) => void, publishIframeMessage: (input: { channelId: string, frameId: string, event: string, payload?: object }) => void, subscribeToIframeChannel: (input: { channelId: string, frameId: string, onMessage: (message: { event: string, payload: object }) => void }) => () => void }} Bridge API.
 */
function createIframeBridge({ mesh }) {
  function registerIframeChannel({ channelId, frameId }) {
    if (!isValidChannelId(channelId) || !isValidFrameId(frameId)) {
      return;
    }

    mesh.publish({
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

    mesh.publish({
      topic: IFRAME_BRIDGE_TOPIC,
      event: IFRAME_CHANNEL_UNREGISTERED_EVENT,
      payload: { channelId, frameId },
      scope: "distributed",
    });
  }

  function publishIframeMessage({ channelId, frameId, event, payload = {} }) {
    if (
      !isValidChannelId(channelId) ||
      !isValidFrameId(frameId) ||
      typeof event !== "string"
    ) {
      return;
    }

    mesh.publish({
      topic: IFRAME_BRIDGE_TOPIC,
      event: IFRAME_MESSAGE_EVENT,
      payload: { channelId, frameId, event, payload },
      scope: "distributed",
    });
  }

  function subscribeToIframeChannel({ channelId, frameId, onMessage }) {
    return mesh.subscribe(IFRAME_BRIDGE_TOPIC, IFRAME_MESSAGE_EVENT, (message) => {
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

  return {
    registerIframeChannel,
    unregisterIframeChannel,
    publishIframeMessage,
    subscribeToIframeChannel,
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
