/**
 * Mounts the FAQ iframe and publishes community.faq-submitted on the host mesh.
 * Role: Provides the reusable FAQ iframe host adapter without outbound callbacks.
 * Not in this file: FAQ persistence or Event Mesh gateway relay validation.
 * Key dependencies: event-mesh/mesh; @shared/iframe-bridge; @shared/community-events.
 * See also: apps/ecommerce-shell/src/pages/homePage.js; MESH_IMPLEMENTATIONS/remote-intents.md.
 */

import mesh from "event-mesh/mesh";
import {
  createIframeBridge,
  createIframeChannel,
} from "@shared/iframe-bridge";
import { createCommunityEvents } from "@shared/community-events";

const FAQ_FORMULARY_HTML_PATH = "faq-formulary.html";
const FAQ_FRAME_ID = "faq-formulary";

const { publishFaqSubmitted } = createCommunityEvents({ mesh });

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

export function mountFaqFormulary(containerElement, props = {}) {
  const iframeBridge = createIframeBridge({ mesh });
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

  iframeBridge.registerIframeChannel({ channelId, frameId: FAQ_FRAME_ID });
  const unsubscribeFromIframeChannel = iframeBridge.subscribeToIframeChannel({
    channelId,
    frameId: FAQ_FRAME_ID,
    onMessage: ({ event, payload }) => {
      if (event === "resized") {
        const frameElement = containerElement.querySelector(
          `iframe[data-frame-id="${FAQ_FRAME_ID}"]`,
        );
        if (frameElement && Number.isFinite(Number(payload.height))) {
          frameElement.style.height = `${Math.max(Number(payload.height), 80)}px`;
        }
        return;
      }

      if (event === "faq-submitted") {
        publishFaqSubmitted(payload);
      }
    },
  });

  return () => {
    unsubscribeFromIframeChannel();
    iframeBridge.unregisterIframeChannel({ channelId, frameId: FAQ_FRAME_ID });
    containerElement.innerHTML = "";
  };
}
