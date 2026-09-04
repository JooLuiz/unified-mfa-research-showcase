/**
 * Configures the standalone formulary iframe's guest Event Mesh bridge.
 * Role: Exposes a narrow window function for the static FAQ/post document.
 * Not in this file: Form rendering, parent subscriptions, or gateway message validation.
 * Key dependencies: event-mesh/mesh; @shared/iframe-bridge.
 * See also: public/faq-formulary.html.
 */

import { configureMesh } from "event-mesh/mesh";
import mesh from "event-mesh/mesh";
import { createIframeBridge } from "@shared/iframe-bridge";

const queryParameters = new URLSearchParams(window.location.search);
const channelId = queryParameters.get("channelId");
const frameId = queryParameters.get("frameId");

configureMesh({
  gatewayUrl: "ws://localhost",
  gatewayPort: 3004,
  enableWebSocket: true,
});

const iframeBridge = createIframeBridge({ mesh });

window.eventMeshIframeBridge = {
  publish(event, payload) {
    iframeBridge.publishIframeMessage({
      channelId,
      frameId,
      event,
      payload,
    });
  },
};
window.dispatchEvent(new Event("iframe-mesh-ready"));
