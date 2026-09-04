import mesh from "event-mesh/mesh";
import {
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

export function mountNewPostFormulary(containerElement, props = {}) {
  const iframeBridge = createIframeBridge({ mesh });
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

      if (event === "post-submitted" && props.onFormSubmitted) {
        props.onFormSubmitted(payload);
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
