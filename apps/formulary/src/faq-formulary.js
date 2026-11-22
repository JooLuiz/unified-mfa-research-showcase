/**
 * Mounts the FAQ formulary iframe and applies host bridge messages.
 * Role: Builds the FAQ iframe URL with a mesh channel and resizes it from iframe bridge events.
 * Not in this file: The child form page or FAQ persistence.
 * Key dependencies: @shared/iframe-bridge.
 * See also: src/new-post-formulary.js.
 */

import {
  FAQ_SUBMITTED_EVENT,
  RESIZED_EVENT,
  createIframeBridge,
  createIframeChannel,
} from "@shared/iframe-bridge";

const FAQ_FORMULARY_HTML_PATH = "faq-formulary.html";
const FAQ_FRAME_ID = "faq-formulary";

function buildFaqFormularyUrl(props, channelId) {
  const baseUrl = new URL(FAQ_FORMULARY_HTML_PATH, __webpack_public_path__);
  const queryParameters = new URLSearchParams({
    type: "faq",
    channelId,
    frameId: FAQ_FRAME_ID,
  });

  if (props.userName) {
    queryParameters.set("name", props.userName);
  }
  if (props.userEmail) {
    queryParameters.set("email", props.userEmail);
  }

  baseUrl.search = queryParameters.toString();
  return baseUrl.toString();
}

function applyFaqIframeHeight(payload) {
  if (!payload || typeof payload !== "object") {
    return;
  }

  const frameId = payload.frameId;
  const rawHeight = Number(payload.height);

  if (frameId !== FAQ_FRAME_ID || !Number.isFinite(rawHeight)) {
    return;
  }

  const frameElement = document.querySelector(
    `iframe[data-frame-id="${FAQ_FRAME_ID}"]`,
  );
  if (frameElement) {
    frameElement.style.height = `${Math.max(rawHeight, 80)}px`;
  }
}

/**
 * Mounts the FAQ iframe and listens for resize and submit messages on the given transport.
 *
 * @param {HTMLElement} containerElement - Host element that receives the iframe.
 * @param {{ userName?: string, userEmail?: string, onFormSubmitted?: (payload: object) => void }} props - Prefill values and the submit callback.
 * @param {{ publish: Function, subscribe: Function }} transport - Shell mesh client, or a recording transport in tests.
 * @returns {() => void} Removes the listeners and clears the container.
 * @sideEffects Writes iframe markup, registers one iframe channel, and subscribes to iframe bridge events.
 */
export function mountFaqFormulary(containerElement, props = {}, transport) {
  const channelId = createIframeChannel();
  const iframeSource = buildFaqFormularyUrl(props, channelId);

  containerElement.innerHTML = `
    <section class="frame-container">
      <iframe
        data-frame-id="${FAQ_FRAME_ID}"
        title="FAQ Formulary"
        src="${iframeSource}"
        scrolling="no"
      ></iframe>
    </section>
  `;

  const iframeElement = containerElement.querySelector("iframe");
  if (iframeElement) {
    iframeElement.style.height = "0px";
  }

  const iframeBridge = createIframeBridge(transport);
  iframeBridge.registerIframeChannel({ channelId, frameId: FAQ_FRAME_ID });
  const unsubscribeFromChannel = iframeBridge.subscribeToIframeChannel({
    channelId,
    frameId: FAQ_FRAME_ID,
    onMessage: ({ event, payload }) => {
      if (event === RESIZED_EVENT) {
        applyFaqIframeHeight({ frameId: FAQ_FRAME_ID, height: payload && payload.height });
        return;
      }
      if (event === FAQ_SUBMITTED_EVENT && props.onFormSubmitted) {
        props.onFormSubmitted(payload);
      }
    },
  });
  const unsubscribeFromResize = iframeBridge.subscribeToIframeEvent(
    RESIZED_EVENT,
    applyFaqIframeHeight,
  );
  const unsubscribeFromSubmit = iframeBridge.subscribeToIframeEvent(
    FAQ_SUBMITTED_EVENT,
    (payload) => {
      if (props.onFormSubmitted) {
        props.onFormSubmitted(payload);
      }
    },
  );

  return () => {
    unsubscribeFromChannel();
    unsubscribeFromResize();
    unsubscribeFromSubmit();
    iframeBridge.unregisterIframeChannel({ channelId, frameId: FAQ_FRAME_ID });
    containerElement.innerHTML = "";
  };
}
