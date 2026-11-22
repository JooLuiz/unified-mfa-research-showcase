/**
 * Mounts the new-post formulary iframe and applies host bridge messages.
 * Role: Builds the post iframe URL with a mesh channel and resizes it from iframe bridge events.
 * Not in this file: The child form page or post persistence.
 * Key dependencies: @shared/iframe-bridge.
 * See also: src/faq-formulary.js.
 */

import {
  POST_SUBMITTED_EVENT,
  RESIZED_EVENT,
  createIframeBridge,
  createIframeChannel,
} from "@shared/iframe-bridge";

const NEW_POST_FORMULARY_HTML_PATH = "faq-formulary.html";
const NEW_POST_FRAME_ID = "new-post-formulary";

function buildNewPostFormularyUrl(props, channelId) {
  const baseUrl = new URL(NEW_POST_FORMULARY_HTML_PATH, __webpack_public_path__);
  const queryParameters = new URLSearchParams({
    type: "post",
    channelId,
    frameId: NEW_POST_FRAME_ID,
  });

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

/**
 * Mounts the new-post iframe and listens for resize and submit messages on the given transport.
 *
 * @param {HTMLElement} containerElement - Host element that receives the iframe.
 * @param {{ userName?: string, userEmail?: string, authorId?: string, onFormSubmitted?: (payload: object) => void }} props - Prefill values and the submit callback.
 * @param {{ publish: Function, subscribe: Function }} transport - Shell mesh client.
 * @returns {() => void} Removes the listeners and clears the container.
 * @sideEffects Writes iframe markup, registers one iframe channel, and subscribes to iframe bridge events.
 */
export function mountNewPostFormulary(containerElement, props = {}, transport) {
  const channelId = createIframeChannel();
  const iframeSource = buildNewPostFormularyUrl(props, channelId);

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

  const iframeBridge = createIframeBridge(transport);
  iframeBridge.registerIframeChannel({ channelId, frameId: NEW_POST_FRAME_ID });
  const unsubscribeFromChannel = iframeBridge.subscribeToIframeChannel({
    channelId,
    frameId: NEW_POST_FRAME_ID,
    onMessage: ({ event, payload }) => {
      if (event === RESIZED_EVENT) {
        applyNewPostIframeHeight({
          frameId: NEW_POST_FRAME_ID,
          height: payload && payload.height,
        });
        return;
      }
      if (event === POST_SUBMITTED_EVENT && props.onFormSubmitted) {
        props.onFormSubmitted(payload);
      }
    },
  });
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
    unsubscribeFromChannel();
    unsubscribeFromResize();
    unsubscribeFromSubmit();
    iframeBridge.unregisterIframeChannel({ channelId, frameId: NEW_POST_FRAME_ID });
    containerElement.innerHTML = "";
  };
}
