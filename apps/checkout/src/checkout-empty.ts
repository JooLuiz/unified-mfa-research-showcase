/**
 * Mounts the empty-checkout iframe and synchronizes its height with the host page.
 * Role: Provides the checkout remote's isolated empty-cart view and publishes path-requested on go-shopping.
 * Not in this file: The child page UI and its Angular bootstrap.
 * Key dependencies: checkout-empty.html; @shared/iframe-bridge; @shared/shell-events; event-mesh/mesh.
 * See also: src/checkout-empty-page.ts; MESH_IMPLEMENTATIONS/remote-intents.md.
 */

import mesh from "event-mesh/mesh";
import {
  createIframeBridge,
  createIframeChannel,
} from "@shared/iframe-bridge";
import { createShellEvents } from "@shared/shell-events";

declare const __webpack_public_path__: string;

const CHECKOUT_EMPTY_HTML_PATH = "checkout-empty.html";
const CHECKOUT_EMPTY_FRAME_ID = "checkout-empty";
const CHECKOUT_EMPTY_FALLBACK_HEIGHT_PX = 220;

const { publishPathRequested } = createShellEvents({ mesh });

function buildCheckoutEmptyUrl(channelId: string): string {
  const baseUrl = new URL(CHECKOUT_EMPTY_HTML_PATH, __webpack_public_path__);
  baseUrl.search = new URLSearchParams({
    channelId,
    frameId: CHECKOUT_EMPTY_FRAME_ID,
  }).toString();
  return baseUrl.toString();
}

/**
 * Applies a valid child-frame resize event to the iframe in this mount only.
 *
 * @param containerElement - Host container that owns the checkout iframe.
 * @param height - Height supplied by the validated bridge event.
 * @returns None.
 * @sideEffects Updates the iframe's inline height when the message is valid.
 */
function updateIframeHeight(
  containerElement: HTMLElement,
  height: unknown,
): void {
  const rawHeight = Number(height);
  if (!Number.isFinite(rawHeight)) {
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
 * @returns Cleanup function that removes the bridge subscription and mounted content.
 * @sideEffects Creates an iframe and registers a targeted mesh bridge channel.
 */
export function mountCheckoutEmpty(containerElement: HTMLElement): () => void {
  const iframeBridge = createIframeBridge({ mesh });
  const channelId = createIframeChannel();
  const iframeSource = buildCheckoutEmptyUrl(channelId);

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

  iframeBridge.registerIframeChannel({
    channelId,
    frameId: CHECKOUT_EMPTY_FRAME_ID,
  });
  const unsubscribeFromIframeChannel = iframeBridge.subscribeToIframeChannel({
    channelId,
    frameId: CHECKOUT_EMPTY_FRAME_ID,
    onMessage: ({ event, payload }) => {
      if (event === "resized") {
        updateIframeHeight(containerElement, payload.height);
        return;
      }

      if (event === "go-shopping") {
        publishPathRequested("/products");
      }
    },
  });

  return () => {
    unsubscribeFromIframeChannel();
    iframeBridge.unregisterIframeChannel({
      channelId,
      frameId: CHECKOUT_EMPTY_FRAME_ID,
    });
    containerElement.innerHTML = "";
  };
}
