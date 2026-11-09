/**
 * Mounts the new-post iframe and publishes community.post-submitted on the host mesh.
 * Role: Provides the reusable create-post iframe host adapter without outbound callbacks.
 * Not in this file: Post persistence or Event Mesh gateway relay validation.
 * Key dependencies: event-mesh/mesh; @shared/iframe-bridge; @shared/community-events.
 * See also: apps/social-media-shell/src/pages/postsPage.js; MESH_IMPLEMENTATIONS/remote-intents.md.
 */

import mesh from "event-mesh/mesh";
import {
  createIframeBridge,
  createIframeChannel,
} from "@shared/iframe-bridge";
import { createCommunityEvents, createPostSubmittedRequest } from "@shared/community-events";

const NEW_POST_FORMULARY_HTML_PATH = "faq-formulary.html";
const NEW_POST_FRAME_ID = "new-post-formulary";
const NEW_POST_IFRAME_FALLBACK_HEIGHT_PX = 220;

const { publishPostSubmitted } = createCommunityEvents(mesh);

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

/**
 * Mounts the create-post iframe and relays post-submitted to the host mesh.
 *
 * @param {HTMLElement} containerElement - Host element that receives the iframe.
 * @param {object} [props] - Optional name, email, and authorId query values.
 * @returns {() => void} Removes the bridge subscription and the iframe.
 * @sideEffects Registers an iframe-bridge channel. The iframe starts at a fallback height until resized arrives.
 */
export function mountNewPostFormulary(containerElement, props = {}) {
  const iframeBridge = createIframeBridge(mesh);
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
    iframeElement.style.height = `${NEW_POST_IFRAME_FALLBACK_HEIGHT_PX}px`;
  }

  iframeBridge.registerIframeChannel({ channelId, frameId: NEW_POST_FRAME_ID });
  const unsubscribeFromIframeChannel = iframeBridge.subscribeToIframeChannel({
    channelId,
    frameId: NEW_POST_FRAME_ID,
    onMessage: ({ event, payload }) => {
      if (event === "resized") {
        const frameElement = containerElement.querySelector(
          `iframe[data-frame-id="${NEW_POST_FRAME_ID}"]`,
        );
        if (frameElement && Number.isFinite(Number(payload.height))) {
          frameElement.style.height = `${Math.max(Number(payload.height), 80)}px`;
        }
        return;
      }

      if (event === "post-submitted") {
        const postRequest = createPostSubmittedRequest(payload);
        if (!postRequest) {
          return;
        }
        publishPostSubmitted(postRequest);
      }
    },
  });

  return () => {
    unsubscribeFromIframeChannel();
    iframeBridge.unregisterIframeChannel({
      channelId,
      frameId: NEW_POST_FRAME_ID,
    });
    containerElement.innerHTML = "";
  };
}
