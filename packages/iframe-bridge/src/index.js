/**
 * Exposes the distributed iframe bridge used by shells and isolated iframe pages.
 * Role: Public barrel for channel helpers and the Event Mesh bridge factory.
 * Not in this file: Mesh configuration, gateway relay persistence, or iframe DOM creation.
 * Key dependencies: src/createIframeBridge.js.
 * See also: apps/mock-data-service/src/event-mesh/iframeBridgeHandler.js.
 */

export {
  IFRAME_BRIDGE_TOPIC,
  IFRAME_CHANNEL_REGISTERED_EVENT,
  IFRAME_CHANNEL_UNREGISTERED_EVENT,
  IFRAME_MESSAGE_EVENT,
  createIframeBridge,
  createIframeChannel,
} from "./createIframeBridge.js";
