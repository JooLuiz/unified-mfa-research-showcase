import {
  FAQ_FRAME_ID,
  CHECKOUT_EMPTY_FRAME_ID,
  FAQ_IFRAME_URL,
  CHECKOUT_EMPTY_IFRAME_URL,
} from "./constants";
import { getCartTotalValue, getCartItemCount } from "./cartActions";
import { isAuthenticated } from "./authActions";
import { navigate } from "./navigate";

function mountHeaderAndFooter(appState, layoutMounts) {
  const headerElement = document.createElement("react-header-mfe");
  headerElement.state = {
    appType: "ecommerce",
    totalPrice: getCartTotalValue(appState),
    itemCount: getCartItemCount(appState),
    isAuthenticated: isAuthenticated(appState),
    currentUserName:
      appState.currentUser?.fullName || appState.currentUser?.username || "",
  };
  headerElement.addEventListener("host:navigate", (event) => {
    navigate(event.detail.path);
  });
  headerElement.addEventListener("host:logout", () => {
    window.dispatchEvent(new CustomEvent("auth:logout-request"));
  });
  layoutMounts.headerMount.appendChild(headerElement);

  const footerElement = document.createElement("vue-footer-mfe");
  footerElement.setAttribute(
    "message",
    "© 2026 Unified MFE Research. All rights reserved.",
  );
  layoutMounts.footerMount.appendChild(footerElement);
}

function mountResizableIframe(containerElement, iframeConfig) {
  containerElement.innerHTML = `
    <section class="frame-container">
      <iframe
        data-frame-id="${iframeConfig.frameId}"
        title="${iframeConfig.title}"
        src="${iframeConfig.src}"
        scrolling="no"
      ></iframe>
    </section>
  `;

  const iframeElement = containerElement.querySelector("iframe");
  if (iframeElement) {
    iframeElement.style.height = "0px";
  }

  return () => {
    containerElement.innerHTML = "";
  };
}

function buildFaqIframeSource(appState) {
  const queryParameters = new URLSearchParams({ type: "faq" });
  const currentUser = appState?.currentUser;
  if (currentUser?.fullName) {
    queryParameters.set("name", currentUser.fullName);
  } else if (currentUser?.username) {
    queryParameters.set("name", currentUser.username);
  }
  if (currentUser?.email) {
    queryParameters.set("email", currentUser.email);
  }
  return `${FAQ_IFRAME_URL}?${queryParameters.toString()}`;
}

function mountFaqIframe(containerElement, appState) {
  return mountResizableIframe(containerElement, {
    title: "FAQ Formulary",
    src: buildFaqIframeSource(appState),
    frameId: FAQ_FRAME_ID,
  });
}

function mountCheckoutEmptyIframe(containerElement) {
  return mountResizableIframe(containerElement, {
    title: "Checkout Empty",
    src: CHECKOUT_EMPTY_IFRAME_URL,
    frameId: CHECKOUT_EMPTY_FRAME_ID,
  });
}

export { mountHeaderAndFooter, mountFaqIframe, mountCheckoutEmptyIframe };
