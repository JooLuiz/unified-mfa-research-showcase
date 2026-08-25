/**
 * Renders the isolated empty-cart iframe document.
 * Role: Owns the child-page Angular UI and posts resize and navigation messages to the host.
 * Not in this file: Host iframe mounting or share-scope initialization.
 * Key dependencies: src/polyfills.ts loaded by src/checkout-empty-entry.ts.
 * See also: src/checkout-empty.ts.
 */

import { Component } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import "./styles.css";

const CHECKOUT_EMPTY_FRAME_ID = "checkout-empty";

function notifyHostHeight(): void {
  const contentHeight = Math.max(
    document.documentElement.scrollHeight,
    document.body.scrollHeight,
  );
  window.parent.postMessage(
    {
      type: "iframe:resize",
      payload: {
        frameId: CHECKOUT_EMPTY_FRAME_ID,
        height: contentHeight,
      },
    },
    "*",
  );
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
    window.parent.postMessage({ type: "checkout:go-shopping" }, "*");
  }
}

bootstrapApplication(CheckoutEmptyPageComponent).then(() => {
  notifyHostHeight();
  window.addEventListener("resize", notifyHostHeight);
});
