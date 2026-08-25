/**
 * Mounts the empty-checkout iframe and synchronizes its height with the host page.
 * Role: Provides the checkout remote's isolated empty-cart view and navigation bridge.
 * Not in this file: The child page UI and its Angular bootstrap.
 * Key dependencies: The checkout-empty.html entry point and browser postMessage API.
 * See also: src/checkout-empty-page.ts.
 */

declare const __webpack_public_path__: string;

const CHECKOUT_EMPTY_HTML_PATH = "checkout-empty.html";
const CHECKOUT_EMPTY_FRAME_ID = "checkout-empty";
const CHECKOUT_EMPTY_FALLBACK_HEIGHT_PX = 220;

interface CheckoutEmptyProps {
  onGoShopping?: () => void;
}

function buildCheckoutEmptyUrl(): string {
  const baseUrl = new URL(CHECKOUT_EMPTY_HTML_PATH, __webpack_public_path__);
  return baseUrl.toString();
}

/**
 * Applies a valid child-frame resize message to the iframe in this mount only.
 *
 * @param containerElement - Host container that owns the checkout iframe.
 * @param event - Cross-window message dispatched by the child frame.
 * @returns None.
 * @sideEffects Updates the iframe's inline height when the message is valid.
 */
function updateIframeHeight(
  containerElement: HTMLElement,
  event: MessageEvent,
): void {
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

  const frameElement = containerElement.querySelector(
    `iframe[data-frame-id="${CHECKOUT_EMPTY_FRAME_ID}"]`,
  );
  if (frameElement instanceof HTMLIFrameElement) {
    frameElement.style.height = `${Math.max(rawHeight, 80)}px`;
  }
}

/**
 * Mounts an empty-cart iframe with a visible fallback height.
 *
 * @param containerElement - Host element that receives the iframe.
 * @param props - Optional callback invoked when the child requests product navigation.
 * @returns Cleanup function that removes message listeners and mounted content.
 * @sideEffects Creates an iframe and registers window message listeners.
 */
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
  if (iframeElement instanceof HTMLIFrameElement) {
    // The fallback keeps checkout usable if the child resize message is delayed or lost.
    iframeElement.style.height = `${CHECKOUT_EMPTY_FALLBACK_HEIGHT_PX}px`;
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

  const handleIframeResize = (event: MessageEvent): void => {
    updateIframeHeight(containerElement, event);
  };

  window.addEventListener("message", handleIframeResize);
  window.addEventListener("message", handlePostMessage);

  return () => {
    window.removeEventListener("message", handleIframeResize);
    window.removeEventListener("message", handlePostMessage);
    containerElement.innerHTML = "";
  };
}
