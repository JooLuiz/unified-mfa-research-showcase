import {
  FAQ_FRAME_ID,
  CHECKOUT_EMPTY_FRAME_ID,
  ORDER_PLACED_FRAME_ID,
  FAQ_IFRAME_URL,
  CHECKOUT_EMPTY_IFRAME_URL,
  ORDER_PLACED_IFRAME_URL,
} from "./constants";
import { getCartTotalValue, getCartItemCount } from "./cartActions";
import { navigate } from "./navigate";

function mountHeaderAndFooter(appState, layoutMounts) {
  const headerElement = document.createElement("react-header-mfe");
  headerElement.state = {
    totalPrice: getCartTotalValue(appState),
    itemCount: getCartItemCount(appState),
  };
  headerElement.addEventListener("host:navigate", (event) => {
    navigate(event.detail.path);
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

function mountFaqIframe(containerElement) {
  return mountResizableIframe(containerElement, {
    title: "FAQ Formulary",
    src: FAQ_IFRAME_URL,
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

function mountOrderPlacedIframe(containerElement) {
  return mountResizableIframe(containerElement, {
    title: "Order Placed",
    src: ORDER_PLACED_IFRAME_URL,
    frameId: ORDER_PLACED_FRAME_ID,
  });
}

export {
  mountHeaderAndFooter,
  mountFaqIframe,
  mountCheckoutEmptyIframe,
  mountOrderPlacedIframe,
};
