/**
 * Publishes empty-checkout iframe messages over event mesh bridge.
 * Role: Owns resize and go-shopping mesh bridge calls for the checkout empty iframe.
 * Not in this file: Angular template rendering or host-side message listeners.
 * Key dependencies: event-mesh/mesh; @shared/iframe-bridge.
 * See also: src/checkout-empty-page.ts.
 */

import { configureMesh } from "event-mesh/mesh";
import mesh from "event-mesh/mesh";
import { createIframeBridge } from "@shared/iframe-bridge";

const CHECKOUT_EMPTY_FRAME_ID = "checkout-empty";
const iframeQueryParameters = new URLSearchParams(window.location.search);
const iframeBridgeChannelId = iframeQueryParameters.get("channelId");
const iframeBridgeFrameId =
  iframeQueryParameters.get("frameId") || CHECKOUT_EMPTY_FRAME_ID;

configureMesh({
  gatewayUrl: "ws://localhost",
  gatewayPort: 3004,
  enableWebSocket: true,
});

const iframeBridge = createIframeBridge({ mesh });

/**
 * Publishes an iframe event through the mesh bridge.
 *
 * @param {string} event - Bridge event name.
 * @param {Record<string, unknown>} payload - Event payload.
 * @returns {void}
 */
function publishToParent(event, payload = {}) {
  if (!iframeBridgeChannelId) {
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
 * Posts the current document height for the empty-checkout frame via mesh bridge.
 *
 * @param {string} [_frameId] - Optional host iframe identifier.
 * @returns {void}
 * @sideEffects Publishes a resized event over the iframe bridge.
 */
function publishCheckoutIframeResize(_frameId) {
  const contentHeight = Math.max(
    document.documentElement.scrollHeight,
    document.body.scrollHeight,
  );
  publishToParent("resized", { height: contentHeight });
}

/**
 * Asks the host to leave checkout and return to shopping via mesh bridge.
 *
 * @returns {void}
 * @sideEffects Publishes a go-shopping event over the iframe bridge.
 */
function publishCheckoutGoShopping() {
  publishToParent("go-shopping");
}

export { publishCheckoutIframeResize, publishCheckoutGoShopping };
