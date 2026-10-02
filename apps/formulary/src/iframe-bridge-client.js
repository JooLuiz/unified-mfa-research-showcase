/**
 * Posts formulary iframe messages to the host window.
 * Role: Owns resize and form-submitted postMessage calls for the FAQ and new-post iframe.
 * Not in this file: Form rendering or host-side message listeners.
 * Key dependencies: window.parent.postMessage.
 * See also: public/faq-formulary.html.
 */

const IFRAME_RESIZE_MESSAGE = "iframe:resize";

/**
 * Posts the current document height for one formulary frame.
 *
 * @param {string} frameId - Host iframe identifier, such as faq-formulary.
 * @returns {void}
 * @sideEffects Posts an iframe:resize message to the parent window.
 */
function publishIframeResize(frameId) {
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
 * Posts a completed formulary payload to the host.
 *
 * @param {string} messageType - faq:form-submitted or post:form-submitted.
 * @param {object} payload - Trimmed field values from the form.
 * @returns {void}
 * @sideEffects Posts the submit message to the parent window.
 */
function publishFormularySubmitted(messageType, payload) {
  window.parent.postMessage(
    {
      type: messageType,
      payload,
    },
    "*",
  );
}

window.iframeBridgeClient = {
  publishIframeResize,
  publishFormularySubmitted,
};
