/**
 * Renders the ecommerce home route.
 * Role: Composes banner, showcase, FAQ formulary iframe, and latest-message notice mounts.
 * Not in this file: FAQ persistence (src/commands/faqCommands.js) or promotion filter storage (src/pages/promotionsPage.js).
 * Key dependencies: Formulary remote iframe at FORMULARY_REMOTE_BASE_URL; window "message" events from the FAQ iframe.
 * See also: src/utils/renderActions.js (public barrel).
 */

import { navigate } from "../utils/navigate";
import { dispatchAddToCartEvent } from "../utils/cartActions";
import { MOCK_API_BASE_URL, FORMULARY_REMOTE_BASE_URL } from "../utils/constants";
import { applyPromotionFilters } from "./promotionsPage";
import { persistFaqAnswerToApi } from "../commands/faqCommands";

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
      onApplyPromotion: (promotionFilters) =>
        applyPromotionFilters(appState, promotionFilters),
    }),
  );
  activeCleanupFunctions.push(
    modules.mountProductShowcase(showcaseMount, {
      showcaseId: firstShowcaseId,
      apiBaseUrl: MOCK_API_BASE_URL,
      fallbackTitle: "New Products Showcase",
      mountProductCard: modules.mountProductCard,
      onProductClick: (productId) => navigate(`/product?productId=${productId}`),
      onAddToCart: dispatchAddToCartEvent,
    }),
  );
  if (appState.isFormularySubmitted) {
    activeCleanupFunctions.push(modules.mountFormularySent(faqMount));
  } else {
    const currentUser = appState.currentUser;
    const faqQueryParameters = new URLSearchParams({ type: "faq" });
    const userName = currentUser?.fullName || currentUser?.username || "";
    const userEmail = currentUser?.email || "";
    if (userName) {
      faqQueryParameters.set("name", userName);
    }
    if (userEmail) {
      faqQueryParameters.set("email", userEmail);
    }
    const faqIframeSource = `${FORMULARY_REMOTE_BASE_URL}/faq-formulary.html?${faqQueryParameters.toString()}`;

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

    function handleFaqIframeResize(event) {
      const messageData = event.data;
      if (!messageData || typeof messageData !== "object") {
        return;
      }
      if (messageData.type !== "iframe:resize") {
        return;
      }
      const frameId = messageData.payload?.frameId;
      const rawHeight = Number(messageData.payload?.height);
      if (frameId !== FAQ_FRAME_ID || !Number.isFinite(rawHeight)) {
        return;
      }
      const frameElement = faqMount.querySelector(`iframe[data-frame-id="${FAQ_FRAME_ID}"]`);
      if (frameElement) {
        frameElement.style.height = `${Math.max(rawHeight, 80)}px`;
      }
    }

    function handleFaqFormSubmitted(event) {
      const messageData = event.data;
      if (!messageData || typeof messageData !== "object") {
        return;
      }
      if (messageData.type === "faq:form-submitted") {
        const payload = messageData.payload;
        appState.isFormularySubmitted = true;
        appState.lastIframeMessage = `FAQ submitted by ${payload.name} (${payload.email})`;
        void persistFaqAnswerToApi(appState, payload);
        window.dispatchEvent(new CustomEvent("global:renderApp"));
      }
    }

    window.addEventListener("message", handleFaqIframeResize);
    window.addEventListener("message", handleFaqFormSubmitted);

    activeCleanupFunctions.push(() => {
      window.removeEventListener("message", handleFaqIframeResize);
      window.removeEventListener("message", handleFaqFormSubmitted);
      faqMount.innerHTML = "";
    });
  }

  if (appState.lastIframeMessage) {
    noticeMount.innerHTML = `<div class="notice-box">Latest iframe message: ${appState.lastIframeMessage}</div>`;
  }
}

export { renderHomePage };
