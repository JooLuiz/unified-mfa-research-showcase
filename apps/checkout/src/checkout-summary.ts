/**
 * Checkout order summary remote.
 * Role: Displays totals and publishes checkout.place-order-requested on the host mesh.
 * Not in this file: Order persistence, cart ownership, or Event Mesh configuration.
 * Key dependencies: event-mesh/mesh singleton; @shared/checkout-events.
 * See also: MESH_IMPLEMENTATIONS/remote-intents.md.
 */

import "@angular/compiler";
import {
  ApplicationRef,
  Component,
  ComponentRef,
  Input,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { createApplication } from "@angular/platform-browser";
import mesh from "event-mesh/mesh";
import { createCheckoutEvents } from "@shared/checkout-events";
import "./styles.css";

const { publishPlaceOrderRequested } = createCheckoutEvents({ mesh });

type CheckoutSummaryProps = {
  subtotal: number;
  discountAmount: number;
};

type CheckoutSummaryHandle = {
  update: (totals: { subtotal: number; discountAmount: number }) => void;
  unmount: () => void;
};

@Component({
  standalone: true,
  selector: "angular-checkout-summary",
  imports: [CommonModule],
  template: `
    <section class="checkout-summary-shell">
      <h3>Checkout Order Summary Component</h3>
      <div class="summary-row">
        <span>Subtotal</span>
        <span>\${{ subtotal.toFixed(2) }}</span>
      </div>
      <div *ngIf="hasDiscount" class="summary-row">
        <span>Discount</span>
        <span>-\${{ discountAmount.toFixed(2) }}</span>
      </div>
      <div class="summary-row">
        <strong>Total</strong>
        <strong>\${{ totalValue.toFixed(2) }}</strong>
      </div>
      <button
        class="place-order-button"
        type="button"
        (click)="handlePlaceOrder()"
      >
        Place Order
      </button>
    </section>
  `,
})
class CheckoutSummaryComponent {
  @Input() subtotal = 0;

  @Input() discountAmount = 0;

  get hasDiscount(): boolean {
    return this.discountAmount > 0;
  }

  get totalValue(): number {
    return Math.max(this.subtotal - this.discountAmount, 0);
  }

  handlePlaceOrder(): void {
    publishPlaceOrderRequested();
  }
}

export function mountCheckoutSummary(
  containerElement: HTMLElement,
  props: CheckoutSummaryProps,
): CheckoutSummaryHandle {
  let applicationRef: ApplicationRef | null = null;
  let componentRef: ComponentRef<CheckoutSummaryComponent> | null = null;
  let isUnmounted = false;

  const bootstrapPromise = createApplication().then((nextApplicationRef) => {
    if (isUnmounted) {
      nextApplicationRef.destroy();
      return;
    }

    applicationRef = nextApplicationRef;
    componentRef = applicationRef.bootstrap(CheckoutSummaryComponent, containerElement);
    componentRef.setInput("subtotal", props.subtotal ?? 0);
    componentRef.setInput("discountAmount", props.discountAmount ?? 0);
  });

  return {
    update: ({ subtotal, discountAmount }) => {
      void bootstrapPromise.then(() => {
        if (!componentRef || isUnmounted) {
          return;
        }
        componentRef.setInput("subtotal", subtotal);
        componentRef.setInput("discountAmount", discountAmount);
      });
    },
    unmount: () => {
      isUnmounted = true;
      void bootstrapPromise.then(() => {
        componentRef?.destroy();
        applicationRef?.destroy();
        containerElement.innerHTML = "";
      });
    },
  };
}
