/**
 * Apply-coupon checkout remote.
 * Role: Validates coupon codes locally and publishes checkout.coupon-applied on the host mesh.
 * Not in this file: Cart totals ownership or Event Mesh configuration.
 * Key dependencies: event-mesh/mesh singleton; @shared/checkout-events.
 * See also: MESH_IMPLEMENTATIONS/remote-intents.md.
 */

import "@angular/compiler";
import {
  ApplicationRef,
  Component,
  ComponentRef,
} from "@angular/core";
import { createApplication } from "@angular/platform-browser";
import mesh from "event-mesh/mesh";
import { createCheckoutEvents } from "@shared/checkout-events";
import "./styles.css";

const { publishCouponApplied } = createCheckoutEvents({ mesh });

type ApplyCouponProps = Record<string, never>;

const couponDiscountMap: Record<string, number> = {
  ten: 10,
  twenty: 20,
  thirty: 30,
  fourty: 40,
  fifty: 50,
};

@Component({
  standalone: true,
  selector: "angular-apply-coupon",
  template: `
    <section class="apply-coupon-shell">
      <h3>Apply Coupon Component</h3>
      <input
        type="text"
        placeholder="Coupon code"
        [value]="couponValue"
        (input)="handleCouponInput($event)"
      />
      <button class="button-like" type="button" (click)="handleApplyCoupon()">Apply Coupon</button>
      <p>{{ couponMessage }}</p>
    </section>
  `,
})
class ApplyCouponComponent {
  couponValue = "";

  couponMessage = "";

  handleCouponInput(event: Event): void {
    const targetInput = event.target as HTMLInputElement | null;
    this.couponValue = (targetInput?.value ?? "").trim().toLowerCase();
  }

  handleApplyCoupon(): void {
    if (!this.couponValue) {
      this.couponMessage = "Please type a coupon code.";
      return;
    }

    const discountPercentage = couponDiscountMap[this.couponValue];
    if (!discountPercentage) {
      this.couponMessage = "Invalid coupon.";
      return;
    }

    this.couponMessage = `Coupon applied: ${discountPercentage}% discount.`;
    publishCouponApplied({
      code: this.couponValue,
      discountPercentage,
    });
  }
}

export function mountApplyCoupon(
  containerElement: HTMLElement,
  _props: ApplyCouponProps = {},
): () => void {
  let applicationRef: ApplicationRef | null = null;
  let componentRef: ComponentRef<ApplyCouponComponent> | null = null;
  let isUnmounted = false;

  const bootstrapPromise = createApplication().then((nextApplicationRef) => {
    if (isUnmounted) {
      nextApplicationRef.destroy();
      return;
    }

    applicationRef = nextApplicationRef;
    componentRef = applicationRef.bootstrap(ApplyCouponComponent, containerElement);
  });

  return () => {
    isUnmounted = true;
    void bootstrapPromise.then(() => {
      componentRef?.destroy();
      applicationRef?.destroy();
      containerElement.innerHTML = "";
    });
  };
}
