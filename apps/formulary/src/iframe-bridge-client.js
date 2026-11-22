/**
 * Publishes formulary iframe messages over the event mesh bridge.
 * Role: Owns resize and form-submitted mesh bridge calls for the FAQ and new-post iframe.
 * Not in this file: Form rendering or host-side message listeners.
 * Key dependencies: event-mesh/mesh; @shared/iframe-bridge.
 * See also: public/faq-formulary.html; src/mountAgnosticFormulary.js.
 */

import { configureMesh } from "event-mesh/mesh";
import mesh from "event-mesh/mesh";
import {
  FAQ_SUBMITTED_EVENT,
  POST_SUBMITTED_EVENT,
  createIframeBridge,
} from "@shared/iframe-bridge";

const EVENT_BY_SUBMITTED_MESSAGE_TYPE = {
  "faq:form-submitted": FAQ_SUBMITTED_EVENT,
  "post:form-submitted": POST_SUBMITTED_EVENT,
};

const iframeQueryParameters = new URLSearchParams(window.location.search);
const iframeBridgeChannelId = iframeQueryParameters.get("channelId");
const iframeBridgeFrameId = iframeQueryParameters.get("frameId");

configureMesh({
  gatewayUrl: "ws://localhost",
  gatewayPort: 3004,
  enableWebSocket: true,
});

const iframeBridge = createIframeBridge(mesh);

/**
 * Publishes one iframe event on the channel from this document's query string.
 *
 * @param {string} event - Bridge event name, such as resized or faq-submitted.
 * @param {object} [payload] - Inner payload. Resize sends height. Submit sends the form fields.
 * @returns {void}
 * @sideEffects Publishes an iframe-bridge channel message. Does nothing when the page has no channelId.
 */
function publishToParent(event, payload = {}) {
  if (!iframeBridgeChannelId || !iframeBridgeFrameId) {
    return;
  }
  iframeBridge.publishIframeMessage({
    channelId: iframeBridgeChannelId,
    frameId: iframeBridgeFrameId,
    event,
    payload,
  });
}

/**
 * Publishes the current document height for this formulary frame.
 *
 * @param {{ publish: Function, subscribe: Function }} [_transport] - Unused. The iframe owns its mesh connection.
 * @param {string} [_frameId] - Unused. The frame id comes from the page query string.
 * @returns {void}
 * @sideEffects Publishes a resized event over the iframe bridge.
 */
function publishIframeResize(_transport, _frameId) {
  const contentHeight = Math.max(
    document.documentElement.scrollHeight,
    document.body.scrollHeight,
  );
  publishToParent("resized", { height: contentHeight });
}

/**
 * Publishes a completed formulary payload to the host.
 *
 * @param {{ publish: Function, subscribe: Function }} [_transport] - Unused. The iframe owns its mesh connection.
 * @param {string} messageType - faq:form-submitted or post:form-submitted.
 * @param {object} payload - Trimmed field values from the form.
 * @returns {void}
 * @sideEffects Publishes the submit message over the iframe bridge.
 */
function publishFormularySubmitted(_transport, messageType, payload) {
  const eventName = EVENT_BY_SUBMITTED_MESSAGE_TYPE[messageType];
  if (!eventName) {
    return;
  }
  publishToParent(eventName, payload);
}

export { publishIframeResize, publishFormularySubmitted };
