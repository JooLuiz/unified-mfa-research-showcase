/**
 * Renders the ecommerce home route.
 * Role: Composes banner, showcase, FAQ formulary iframe, and latest-message notice mounts.
 * Not in this file: FAQ persistence (src/commands/faqCommands.js) or promotion intents (mesh handlers in src/main.js).
 * Key dependencies: Formulary remote iframe at FORMULARY_REMOTE_BASE_URL; banners publish promotion-applied on mesh.
 * See also: src/utils/renderActions.js (public barrel).
 */

import { MOCK_API_BASE_URL, FORMULARY_REMOTE_BASE_URL } from "../utils/constants";
import { persistFaqAnswerToApi } from "../commands/faqCommands";
import { publishRenderRequested } from "../events/eventBus";
import mesh from "event-mesh/mesh";
import {
  createIframeBridge,
  createIframeChannel,
} from "@shared/iframe-bridge";

const FAQ_FRAME_ID = "faq-formulary";

/**
 * Renders the home page with banner, showcase, FAQ form, and iframe notice sections.
 *
 * @param {object} appState - Shell state holding banners, showcases, user, and FAQ status.
 * @param {HTMLElement} pageMount - Route container element.
 * @param {object} modules - Loaded remote module mount functions.
 * @param {Array<() => void>} activeCleanupFunctions - Cleanup registry for the current route.
 * @returns {Promise<void>}
 * @sideEffects Subscribes to window "message" events until the route cleanup runs.
 */
async function renderHomePage(appState, pageMount, modules, activeCleanupFunctions) {
  pageMount.innerHTML = `
    <div id="bannerMount"></div>
    <div id="showcaseMount"></div>
    <div id="faqMount"></div>
    <div id="noticeMount"></div>
  `;

  const bannerMount = pageMount.querySelector("#bannerMount");
  const showcaseMount = pageMount.querySelector("#showcaseMount");
  const faqMount = pageMount.querySelector("#faqMount");
  const noticeMount = pageMount.querySelector("#noticeMount");

  const firstBannerId = appState.banners[0]?.id;
  const firstShowcaseId = appState.showcases[0]?.id;

  activeCleanupFunctions.push(
    modules.mountPromotionalBanner(bannerMount, {
      bannerId: firstBannerId,
      apiBaseUrl: MOCK_API_BASE_URL,
    }),
  );
  activeCleanupFunctions.push(
    modules.mountProductShowcase(showcaseMount, {
      showcaseId: firstShowcaseId,
      apiBaseUrl: MOCK_API_BASE_URL,
    }),
  );

  if (faqMount) {
    const iframeBridge = createIframeBridge({ mesh });
    const channelId = createIframeChannel();
    const faqIframeSourceUrl = new URL(
      "faq-formulary.html",
      FORMULARY_REMOTE_BASE_URL,
    );
    faqIframeSourceUrl.search = new URLSearchParams({
      type: "faq",
      channelId,
      frameId: FAQ_FRAME_ID,
    }).toString();
    const faqIframeSource = faqIframeSourceUrl.toString();

    faqMount.innerHTML = `
      <section class="frame-container">
        <iframe
          data-frame-id="${FAQ_FRAME_ID}"
          title="FAQ Formulary"
          src="${faqIframeSource}"
          scrolling="no"
        ></iframe>
      </section>
    `;

    const faqIframeElement = faqMount.querySelector("iframe");
    if (faqIframeElement) {
      faqIframeElement.style.height = "0px";
    }

    iframeBridge.registerIframeChannel({ channelId, frameId: FAQ_FRAME_ID });
    const unsubscribeFromIframeChannel = iframeBridge.subscribeToIframeChannel({
      channelId,
      frameId: FAQ_FRAME_ID,
      onMessage: ({ event, payload }) => {
        if (event === "resized") {
          const frameElement = faqMount.querySelector(
            `iframe[data-frame-id="${FAQ_FRAME_ID}"]`,
          );
          if (frameElement && Number.isFinite(Number(payload.height))) {
            frameElement.style.height = `${Math.max(Number(payload.height), 80)}px`;
          }
          return;
        }

        if (event === "faq-submitted") {
          appState.isFormularySubmitted = true;
          appState.lastIframeMessage = `FAQ submitted by ${payload.name} (${payload.email})`;
          void persistFaqAnswerToApi(appState, payload);
          publishRenderRequested();
        }
      },
    });

    activeCleanupFunctions.push(() => {
      unsubscribeFromIframeChannel();
      iframeBridge.unregisterIframeChannel({ channelId, frameId: FAQ_FRAME_ID });
      faqMount.innerHTML = "";
    });
  }

  if (noticeMount && appState.lastIframeMessage) {
    noticeMount.innerHTML = "";
    const noticeSection = document.createElement("section");
    noticeSection.className = "notice-box";
    const noticeParagraph = document.createElement("p");
    noticeParagraph.textContent = String(appState.lastIframeMessage);
    noticeSection.appendChild(noticeParagraph);
    noticeMount.appendChild(noticeSection);
  }
}

export { renderHomePage };
