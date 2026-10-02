/**
 * Mounts the FAQ formulary iframe and applies host bridge messages.
 * Role: Builds the FAQ iframe URL and resizes it from iframe bridge events.
 * Not in this file: The child form page or FAQ persistence.
 * Key dependencies: @shared/iframe-bridge.
 * See also: src/new-post-formulary.js.
 */

import {
  FAQ_SUBMITTED_EVENT,
  RESIZED_EVENT,
  createIframeBridge,
  createPostMessageTransport,
} from "@shared/iframe-bridge";

const FAQ_FORMULARY_HTML_PATH = "faq-formulary.html";
const FAQ_FRAME_ID = "faq-formulary";

function buildFaqFormularyUrl(props) {
  const baseUrl = new URL(FAQ_FORMULARY_HTML_PATH, __webpack_public_path__);
  const queryParameters = new URLSearchParams({ type: "faq" });

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

export function mountFaqFormulary(containerElement, props = {}) {
  const iframeSource = buildFaqFormularyUrl(props);

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

  const iframeBridge = createIframeBridge(createPostMessageTransport());
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
    unsubscribeFromResize();
    unsubscribeFromSubmit();
    containerElement.innerHTML = "";
  };
}
