/**
 * Posts empty-checkout iframe messages to the host window.
 * Role: Owns resize and go-shopping postMessage calls for the checkout empty iframe.
 * Not in this file: Angular template rendering or host-side message listeners.
 * Key dependencies: window.parent.postMessage.
 * See also: src/checkout-empty-page.ts.
 */

const IFRAME_RESIZE_MESSAGE = "iframe:resize";
const CHECKOUT_GO_SHOPPING_MESSAGE = "checkout:go-shopping";

/**
 * Posts the current document height for the empty-checkout frame.
 *
 * @param {string} frameId - Host iframe identifier.
 * @returns {void}
 * @sideEffects Posts an iframe:resize message to the parent window.
 */
function publishCheckoutIframeResize(frameId) {
  const contentHeight = Math.max(
    document.documentElement.scrollHeight,
    document.body.scrollHeight,
  );
  window.parent.postMessage(
    {
      type: IFRAME_RESIZE_MESSAGE,
      payload: {
        frameId,
        height: contentHeight,
      },
    },
    "*",
  );
}

/**
 * Asks the host to leave checkout and return to shopping.
 *
 * @returns {void}
 * @sideEffects Posts a checkout:go-shopping message to the parent window.
 */
function publishCheckoutGoShopping() {
  window.parent.postMessage({ type: CHECKOUT_GO_SHOPPING_MESSAGE }, "*");
}

export { publishCheckoutIframeResize, publishCheckoutGoShopping };
