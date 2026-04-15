import "@angular/compiler";
import {
  ApplicationRef,
  Component,
  ComponentRef,
  EventEmitter,
  Output,
} from "@angular/core";
import { createApplication } from "@angular/platform-browser";
import "./styles.css";

type CouponPayload = {
  code: string;
  discountPercentage: number;
};

type ApplyCouponProps = {
  onCouponApplied?: (payload: CouponPayload) => void;
};

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
  @Output() couponApplied = new EventEmitter<CouponPayload>();

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
    this.couponApplied.emit({
      code: this.couponValue,
      discountPercentage,
    });
  }
}

export function mountApplyCoupon(containerElement: HTMLElement, props: ApplyCouponProps): () => void {
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
    componentRef.instance.couponApplied.subscribe((payload) => {
      props.onCouponApplied?.(payload);
    });
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
