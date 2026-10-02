/**
 * Configures the standalone formulary iframe's guest Event Mesh bridge.
 * Role: Exposes window.iframeBridgeClient for the static FAQ and new-post formulary documents.
 * Not in this file: Form rendering, parent subscriptions, or gateway message validation.
 * Key dependencies: event-mesh/mesh; @shared/iframe-bridge.
 * See also: public/faq-formulary.html.
 */

import { configureMesh } from "event-mesh/mesh";
import mesh from "event-mesh/mesh";
import { createIframeBridge } from "@shared/iframe-bridge";

configureMesh({
  gatewayUrl: "ws://localhost",
  gatewayPort: 3004,
  enableWebSocket: true,
});

const iframeBridge = createIframeBridge({ mesh });

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
 * @param {string} [targetFrameId] - Frame identifier.
 * @returns {void}
 */
function publishIframeResize(targetFrameId) {
  const context = getBridgeContext();
  const contentHeight = Math.max(
    document.documentElement.scrollHeight,
    document.body.scrollHeight,
  );
  iframeBridge.publishIframeMessage({
    channelId: context.channelId,
    frameId: targetFrameId || context.frameId,
    event: "resized",
    payload: {
      height: contentHeight,
    },
  });
}

/**
 * Publishes submitted form data to the host iframe bridge channel.
 *
 * @param {string} event - Event name (e.g. faq-submitted or post-submitted).
 * @param {object} payload - Form payload.
 * @returns {void}
 */
function publishFormularySubmitted(event, payload) {
  const context = getBridgeContext();
  iframeBridge.publishIframeMessage({
    channelId: context.channelId,
    frameId: context.frameId,
    event,
    payload,
  });
}

window.iframeBridgeClient = {
  publishIframeResize,
  publishFormularySubmitted,
};

window.dispatchEvent(new Event("iframe-mesh-ready"));
