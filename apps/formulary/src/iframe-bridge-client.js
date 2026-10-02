/**
 * Posts formulary iframe messages to the host window.
 * Role: Owns resize and form-submitted calls for the FAQ and new-post iframe.
 * Not in this file: Form rendering or host-side message listeners.
 * Key dependencies: @shared/iframe-bridge.
 * See also: public/faq-formulary.html.
 */

import {
  FAQ_SUBMITTED_EVENT,
  POST_SUBMITTED_EVENT,
  RESIZED_EVENT,
  createIframeBridge,
  createPostMessageTransport,
} from "@shared/iframe-bridge";

const EVENT_BY_SUBMITTED_MESSAGE_TYPE = {
  "faq:form-submitted": FAQ_SUBMITTED_EVENT,
  "post:form-submitted": POST_SUBMITTED_EVENT,
};

const iframeBridge = createIframeBridge(createPostMessageTransport());

/**
 * Posts the current document height for one formulary frame.
 *
 * @param {string} frameId - Host iframe identifier, such as faq-formulary.
 * @returns {void}
 * @sideEffects Publishes an iframe resized message to the parent window.
 */
function publishIframeResize(frameId) {
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
 * Posts a completed formulary payload to the host.
 *
 * @param {string} messageType - faq:form-submitted or post:form-submitted.
 * @param {object} payload - Trimmed field values from the form.
 * @returns {void}
 * @sideEffects Publishes the submit message to the parent window.
 */
function publishFormularySubmitted(messageType, payload) {
  const eventName = EVENT_BY_SUBMITTED_MESSAGE_TYPE[messageType];
  if (!eventName) {
    return;
  }
  iframeBridge.publishIframeMessage(eventName, payload);
}

window.iframeBridgeClient = {
  publishIframeResize,
  publishFormularySubmitted,
};
