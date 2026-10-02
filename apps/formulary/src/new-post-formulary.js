/**
 * Mounts the new-post formulary iframe and applies host bridge messages.
 * Role: Builds the post iframe URL and resizes it from iframe bridge events.
 * Not in this file: The child form page or post persistence.
 * Key dependencies: @shared/iframe-bridge.
 * See also: src/faq-formulary.js.
 */

import {
  POST_SUBMITTED_EVENT,
  RESIZED_EVENT,
  createIframeBridge,
  createPostMessageTransport,
} from "@shared/iframe-bridge";

const NEW_POST_FORMULARY_HTML_PATH = "faq-formulary.html";
const NEW_POST_FRAME_ID = "new-post-formulary";

function buildNewPostFormularyUrl(props) {
  const baseUrl = new URL(NEW_POST_FORMULARY_HTML_PATH, __webpack_public_path__);
  const queryParameters = new URLSearchParams({ type: "post" });

  if (props.userName) {
    queryParameters.set("name", props.userName);
  }
  if (props.userEmail) {
    queryParameters.set("email", props.userEmail);
  }
  if (props.authorId) {
    queryParameters.set("authorId", props.authorId);
  }

  baseUrl.search = queryParameters.toString();
  return baseUrl.toString();
}

function applyNewPostIframeHeight(payload) {
  if (!payload || typeof payload !== "object") {
    return;
  }

  const frameId = payload.frameId;
  const rawHeight = Number(payload.height);

  if (frameId !== NEW_POST_FRAME_ID || !Number.isFinite(rawHeight)) {
    return;
  }

  const frameElement = document.querySelector(
    `iframe[data-frame-id="${NEW_POST_FRAME_ID}"]`,
  );
  if (frameElement) {
    frameElement.style.height = `${Math.max(rawHeight, 80)}px`;
  }
}

export function mountNewPostFormulary(containerElement, props = {}) {
  const iframeSource = buildNewPostFormularyUrl(props);

  containerElement.innerHTML = `
    <section class="frame-container">
      <iframe
        data-frame-id="${NEW_POST_FRAME_ID}"
        title="Create new post"
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
    applyNewPostIframeHeight,
  );
  const unsubscribeFromSubmit = iframeBridge.subscribeToIframeEvent(
    POST_SUBMITTED_EVENT,
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
