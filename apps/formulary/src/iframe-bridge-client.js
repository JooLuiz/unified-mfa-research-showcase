/**
 * Publishes formulary iframe messages on the guest Event Mesh bridge.
 * Role: Maps the shared mount's resize and form-submitted calls onto iframe channel events.
 * Not in this file: Form rendering, parent subscriptions, or gateway message validation.
 * Key dependencies: event-mesh/mesh; @shared/iframe-bridge; src/mountAgnosticFormulary.js.
 * See also: public/faq-formulary.html; src/mountAgnosticFormulary.js.
 */

import { configureMesh } from "event-mesh/mesh";
import mesh from "event-mesh/mesh";
import { createIframeBridge } from "@shared/iframe-bridge";

configureMesh({
  gatewayUrl: "ws://localhost",
  gatewayPort: 3004,
  enableWebSocket: true,
});

const MESH_EVENT_BY_MESSAGE_TYPE = {
  "faq:form-submitted": "faq-submitted",
  "post:form-submitted": "post-submitted",
};

const iframeBridge = createIframeBridge(mesh);

function getBridgeContext() {
  const queryParameters = new URLSearchParams(window.location.search);
  return {
    channelId: queryParameters.get("channelId"),
    frameId: queryParameters.get("frameId"),
  };
}

/**
 * Publishes document height to the host iframe bridge channel.
 *
 * @param {string} [frameId] - Host iframe identifier, such as faq-formulary.
 * @returns {void}
 * @sideEffects Publishes an iframe resized message on the formulary channel.
 */
function publishIframeResize(frameId) {
  const context = getBridgeContext();
  const contentHeight = Math.max(
    document.documentElement.scrollHeight,
    document.body.scrollHeight,
  );
  iframeBridge.publishIframeMessage({
    channelId: context.channelId,
    frameId: frameId || context.frameId,
    event: "resized",
    payload: {
      height: contentHeight,
    },
  });
}

/**
 * Publishes a completed formulary payload on the host iframe channel.
 *
 * @param {string} messageType - faq:form-submitted or post:form-submitted.
 * @param {object} payload - Trimmed field values from the form.
 * @returns {void}
 * @sideEffects Publishes faq-submitted or post-submitted when messageType is known.
 */
function publishFormularySubmitted(messageType, payload) {
  const eventName = MESH_EVENT_BY_MESSAGE_TYPE[messageType];
  if (!eventName) {
    return;
  }
  const context = getBridgeContext();
  iframeBridge.publishIframeMessage({
    channelId: context.channelId,
    frameId: context.frameId,
    event: eventName,
    payload,
  });
}

export { publishIframeResize, publishFormularySubmitted };
