/**
 * Renders the isolated empty-cart iframe document.
 * Role: Owns the child-page Angular UI and delegates bridge messages to src/iframe-bridge-client.js.
 * Not in this file: Host iframe mounting, share-scope initialization, or mesh bridge implementation.
 * Key dependencies: src/polyfills.ts loaded by src/checkout-empty-entry.ts; src/iframe-bridge-client.js.
 * See also: src/checkout-empty.ts.
 */

import { Component } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import {
  publishCheckoutGoShopping,
  publishCheckoutIframeResize,
} from "./iframe-bridge-client.js";
import "./styles.css";

const CHECKOUT_EMPTY_FRAME_ID = "checkout-empty";

function notifyHostHeight(): void {
  publishCheckoutIframeResize(CHECKOUT_EMPTY_FRAME_ID);
}

@Component({
  standalone: true,
  selector: "checkout-empty-root",
  template: `
    <section class="checkout-empty-shell">
      <h2>There are no items in your cart</h2>
      <p>Please add some items to your cart to proceed</p>
      <button
        type="button"
        class="checkout-empty-go-back-button"
        (click)="handleGoBackToShopping()"
      >
        Go Back to Shopping
      </button>
    </section>
  `,
})
class CheckoutEmptyPageComponent {
  handleGoBackToShopping(): void {
    publishCheckoutGoShopping();
  }
}

bootstrapApplication(CheckoutEmptyPageComponent).then(() => {
  notifyHostHeight();
  window.addEventListener("resize", notifyHostHeight);
});
