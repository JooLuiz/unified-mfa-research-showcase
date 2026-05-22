declare const __webpack_public_path__: string;

const CHECKOUT_EMPTY_HTML_PATH = "checkout-empty.html";
const CHECKOUT_EMPTY_FRAME_ID = "checkout-empty";

interface CheckoutEmptyProps {
  onGoShopping?: () => void;
}

function buildCheckoutEmptyUrl(): string {
  const baseUrl = new URL(CHECKOUT_EMPTY_HTML_PATH, __webpack_public_path__);
  return baseUrl.toString();
}

function handleIframeResize(event: MessageEvent): void {
  const messageData = event.data;
  if (!messageData || typeof messageData !== "object") {
    return;
  }

  if (messageData.type !== "iframe:resize") {
    return;
  }

  const frameId = messageData.payload?.frameId;
  const rawHeight = Number(messageData.payload?.height);

  if (frameId !== CHECKOUT_EMPTY_FRAME_ID || !Number.isFinite(rawHeight)) {
    return;
  }

  const frameElement = document.querySelector(
    `iframe[data-frame-id="${CHECKOUT_EMPTY_FRAME_ID}"]`,
  );
  if (frameElement instanceof HTMLIFrameElement) {
    frameElement.style.height = `${Math.max(rawHeight, 80)}px`;
  }
}

export function mountCheckoutEmpty(
  containerElement: HTMLElement,
  props: CheckoutEmptyProps = {},
): () => void {
  const iframeSource = buildCheckoutEmptyUrl();

  containerElement.innerHTML = `
    <section class="frame-container">
      <iframe
        data-frame-id="${CHECKOUT_EMPTY_FRAME_ID}"
        title="Checkout Empty"
        src="${iframeSource}"
        scrolling="no"
      ></iframe>
    </section>
  `;

  const iframeElement = containerElement.querySelector("iframe");
  if (iframeElement) {
    iframeElement.style.height = "0px";
  }

  function handlePostMessage(event: MessageEvent): void {
    const messageData = event.data;
    if (!messageData || typeof messageData !== "object") {
      return;
    }

    if (messageData.type === "checkout:go-shopping" && props.onGoShopping) {
      props.onGoShopping();
    }
  }

  window.addEventListener("message", handleIframeResize);
  window.addEventListener("message", handlePostMessage);

  return () => {
    window.removeEventListener("message", handleIframeResize);
    window.removeEventListener("message", handlePostMessage);
    containerElement.innerHTML = "";
  };
}
