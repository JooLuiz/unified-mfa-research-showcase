/**
 * Posts empty-checkout iframe messages to the host window.
 * Role: Owns resize and go-shopping calls for the checkout empty iframe.
 * Not in this file: Angular template rendering or host-side message listeners.
 * Key dependencies: @shared/iframe-bridge.
 * See also: src/checkout-empty-page.ts.
 */

import {
  GO_SHOPPING_EVENT,
  RESIZED_EVENT,
  createIframeBridge,
  createPostMessageTransport,
} from "@shared/iframe-bridge";

const iframeBridge = createIframeBridge(createPostMessageTransport());

/**
 * Posts the current document height for the empty-checkout frame.
 *
 * @param {string} frameId - Host iframe identifier.
 * @returns {void}
 * @sideEffects Publishes an iframe resized message to the parent window.
 */
function publishCheckoutIframeResize(frameId) {
  const contentHeight = Math.max(
    document.documentElement.scrollHeight,
    document.body.scrollHeight,
  );
  iframeBridge.publishIframeMessage(RESIZED_EVENT, {
    frameId,
    height: contentHeight,
  });
}

/**
 * Asks the host to leave checkout and return to shopping.
 *
 * @returns {void}
 * @sideEffects Publishes a go-shopping message to the parent window.
 */
function publishCheckoutGoShopping() {
  iframeBridge.publishIframeMessage(GO_SHOPPING_EVENT);
}

export { publishCheckoutGoShopping, publishCheckoutIframeResize };
