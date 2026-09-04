/**
 * Relays validated cross-origin iframe mesh messages to their owning shell client.
 * Role: Maps short-lived iframe channels to gateway clients and performs targeted delivery.
 * Not in this file: Iframe DOM behavior, mesh connection authentication, or business command handling.
 * Key dependencies: event-mesh/gateway; gateway authorization in src/event-mesh/gatewayAuth.js.
 * See also: src/server.js; packages/iframe-bridge/src/index.js.
 */

const IFRAME_BRIDGE_TOPIC = "iframe-bridge";
const IFRAME_CHANNEL_REGISTERED_EVENT = "registered";
const IFRAME_CHANNEL_UNREGISTERED_EVENT = "unregistered";
const IFRAME_MESSAGE_EVENT = "message";
const IFRAME_CHANNEL_TTL_MS = 5 * 60 * 1000;
const ALLOWED_FRAME_EVENTS = Object.freeze({
  "faq-formulary": new Set(["resized", "faq-submitted"]),
  "new-post-formulary": new Set(["resized", "post-submitted"]),
  "checkout-empty": new Set(["resized", "go-shopping"]),
});

/** @type {Map<string, { frameId: string, parentClientId: string, expiresAt: number }>} */
const iframeChannelsById = new Map();

function isValidChannelId(channelId) {
  return typeof channelId === "string" && /^[a-z0-9-]{36}$/.test(channelId);
}

function isValidFrameId(frameId) {
  return Object.hasOwn(ALLOWED_FRAME_EVENTS, frameId);
}

function purgeExpiredIframeChannels() {
  const currentTime = Date.now();
  iframeChannelsById.forEach((channel, channelId) => {
    if (channel.expiresAt <= currentTime) {
      iframeChannelsById.delete(channelId);
    }
  });
}

function isValidBridgePayload(frameId, event, payload) {
  if (!ALLOWED_FRAME_EVENTS[frameId]?.has(event)) {
    return false;
  }

  if (event === "resized") {
    return Number.isFinite(Number(payload?.height)) && Number(payload.height) >= 0;
  }

  if (event === "faq-submitted") {
    return (
      typeof payload?.name === "string" &&
      typeof payload?.email === "string" &&
      typeof payload?.contactMethod === "string" &&
      typeof payload?.question === "string"
    );
  }

  if (event === "post-submitted") {
    return (
      typeof payload?.content === "string" &&
      typeof payload?.imageUrl === "string"
    );
  }

  return event === "go-shopping" && (!payload || typeof payload === "object");
}

/**
 * Registers gateway subscribers that relay one iframe channel to one parent shell client.
 *
 * @returns {Promise<void>}
 * @sideEffects Stores short-lived channel registrations and sends targeted gateway messages.
 */
async function registerIframeBridgeHandler() {
  const gatewayModule = await import("event-mesh/gateway");
  const gateway = gatewayModule.default;

  gateway.subscribe(
    IFRAME_BRIDGE_TOPIC,
    IFRAME_CHANNEL_REGISTERED_EVENT,
    (incomingMessage) => {
      const { channelId, frameId } = incomingMessage.payload || {};
      if (!isValidChannelId(channelId) || !isValidFrameId(frameId)) {
        return;
      }

      purgeExpiredIframeChannels();
      iframeChannelsById.set(channelId, {
        frameId,
        parentClientId: incomingMessage.sourceClientId,
        expiresAt: Date.now() + IFRAME_CHANNEL_TTL_MS,
      });
    },
  );

  gateway.subscribe(
    IFRAME_BRIDGE_TOPIC,
    IFRAME_CHANNEL_UNREGISTERED_EVENT,
    (incomingMessage) => {
      const { channelId, frameId } = incomingMessage.payload || {};
      const channel = iframeChannelsById.get(channelId);
      if (
        !isValidChannelId(channelId) ||
        !isValidFrameId(frameId) ||
        !channel ||
        channel.frameId !== frameId ||
        channel.parentClientId !== incomingMessage.sourceClientId
      ) {
        return;
      }

      iframeChannelsById.delete(channelId);
    },
  );

  gateway.subscribe(IFRAME_BRIDGE_TOPIC, IFRAME_MESSAGE_EVENT, (incomingMessage) => {
    const { channelId, frameId, event, payload } = incomingMessage.payload || {};
    if (
      !isValidChannelId(channelId) ||
      !isValidFrameId(frameId) ||
      typeof event !== "string" ||
      !isValidBridgePayload(frameId, event, payload)
    ) {
      return;
    }

    purgeExpiredIframeChannels();
    const channel = iframeChannelsById.get(channelId);
    if (!channel || channel.frameId !== frameId) {
      return;
    }

    gateway.publish({
      topic: IFRAME_BRIDGE_TOPIC,
      event: IFRAME_MESSAGE_EVENT,
      payload: { channelId, frameId, event, payload },
      targetClientId: channel.parentClientId,
    });
  });
}

module.exports = { registerIframeBridgeHandler };
