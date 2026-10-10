import "@angular/compiler";
import {
  ApplicationRef,
  Component,
  ComponentRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { createApplication } from "@angular/platform-browser";
import "./styles.css";
import { CheckoutAvailabilityWatcher } from "./checkout-availability-watcher";

type Product = {
  id: string;
  name: string;
  price: number;
  image: string;
};

type CartItem = {
  productId: string;
  quantity: number;
};

type ProductsById = Record<string, Product>;

type CheckoutItemsProps = {
  productsById: ProductsById;
  apiBaseUrl?: string | null;
  onQuantityChange?: (productId: string, quantity: number) => void;
  onRemoveItem?: (productId: string) => void;
};

declare global {
  interface Window {
    __APP_SHELL_CART__?: unknown;
  }
}

const normalizeQuantity = (nextQuantity: number): number => {
  const parsedQuantity = Number(nextQuantity);
  if (!Number.isFinite(parsedQuantity) || parsedQuantity < 1) {
    return 1;
  }
  return Math.floor(parsedQuantity);
};

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as { productId?: unknown; quantity?: unknown };
  if (typeof candidate.productId !== "string" || candidate.productId.trim() === "") {
    return false;
  }

  const parsedQuantity = Number(candidate.quantity);
  return Number.isFinite(parsedQuantity) && parsedQuantity >= 1;
}

function readCartItemsFromGlobalState(): CartItem[] {
  const globalCart = window.__APP_SHELL_CART__;
  if (!Array.isArray(globalCart)) {
    return [];
  }

  return globalCart
    .filter(isCartItem)
    .map((cartItem) => ({
      productId: cartItem.productId,
      quantity: normalizeQuantity(cartItem.quantity),
    }));
}

@Component({
  standalone: true,
  selector: "angular-checkout-items",
  imports: [CommonModule],
  template: `
    <section class="checkout-items-shell">
      <h2>Checkout</h2>
      <p *ngIf="cartItems.length === 0">Your cart is empty.</p>
      <article
        *ngFor="let cartItem of cartItems; trackBy: trackByProductId"
        class="checkout-item"
      >
        <ng-container *ngIf="productsById[cartItem.productId] as product">
          <img [src]="product.image" [alt]="product.name" class="checkout-item-image" />
          <div class="checkout-item-details">
            <strong>{{ product.name }}</strong>
            <span>\${{ (product.price * cartItem.quantity).toFixed(2) }}</span>
            <button
              type="button"
              class="checkout-item-remove-button"
              (click)="handleRemoveItem(cartItem.productId)"
            >
              Remove
            </button>
          </div>
          <div class="checkout-quantity-shell">
            <button
              class="checkout-quantity-button"
              type="button"
              (click)="handleDecreaseQuantity(cartItem)"
            >
              -
            </button>
            <input
              class="checkout-quantity-input"
              type="number"
              min="1"
              [attr.max]="getMaxAllowedQuantity(cartItem)"
              [value]="cartItem.quantity"
              (change)="handleQuantityChange($event, cartItem.productId)"
            />
            <button
              class="checkout-quantity-button"
              type="button"
              [disabled]="isAtMaxQuantity(cartItem)"
              (click)="handleIncreaseQuantity(cartItem)"
            >
              +
            </button>
          </div>
          <p *ngIf="isAtMaxQuantity(cartItem)" class="checkout-item-max-reached">
            No more available
          </p>
        </ng-container>
      </article>
    </section>
  `,
})
class CheckoutItemsComponent implements OnChanges, OnDestroy {
  @Input() cartItems: CartItem[] = [];

  @Input() productsById: ProductsById = {};

  @Input() apiBaseUrl: string | null = null;

  @Output() quantityChange = new EventEmitter<{
    productId: string;
    quantity: number;
  }>();

  @Output() removeItem = new EventEmitter<string>();

  availableByProductId: Record<string, number> = {};

  private readonly availabilityWatcher = new CheckoutAvailabilityWatcher(
    (productId, nextAvailable) => {
      this.availableByProductId = { ...this.availableByProductId, [productId]: nextAvailable };
    },
  );

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["apiBaseUrl"]) {
      this.availabilityWatcher.setApiBaseUrl(this.apiBaseUrl);
    }
    if (changes["cartItems"] || changes["apiBaseUrl"]) {
      this.availabilityWatcher.syncWatchedProductIds(
        this.cartItems.map((cartItem) => cartItem.productId),
      );
    }
  }

  ngOnDestroy(): void {
    this.availabilityWatcher.stopWatchingAll();
  }

  trackByProductId(_index: number, cartItem: CartItem): string {
    return cartItem.productId;
  }

  /**
   * The highest quantity this line can be set to given its own held quantity plus the live
   * available count, or null when the available count for this product is not yet known.
   */
  getMaxAllowedQuantity(cartItem: CartItem): number | null {
    const available = this.availableByProductId[cartItem.productId];
    if (typeof available !== "number") {
      return null;
    }
    return cartItem.quantity + available;
  }

  isAtMaxQuantity(cartItem: CartItem): boolean {
    const maxAllowed = this.getMaxAllowedQuantity(cartItem);
    return typeof maxAllowed === "number" && cartItem.quantity >= maxAllowed;
  }

  handleDecreaseQuantity(cartItem: CartItem): void {
    const nextQuantity = Math.max(cartItem.quantity - 1, 1);
    this.quantityChange.emit({
      productId: cartItem.productId,
      quantity: nextQuantity,
    });
  }

  handleIncreaseQuantity(cartItem: CartItem): void {
    const maxAllowed = this.getMaxAllowedQuantity(cartItem);
    const desiredQuantity = cartItem.quantity + 1;
    const nextQuantity =
      typeof maxAllowed === "number" ? Math.min(desiredQuantity, maxAllowed) : desiredQuantity;
    if (nextQuantity === cartItem.quantity) {
      return;
    }
    this.quantityChange.emit({
      productId: cartItem.productId,
      quantity: nextQuantity,
    });
  }

  handleQuantityChange(event: Event, productId: string): void {
    const targetInput = event.target as HTMLInputElement | null;
    const cartItem = this.cartItems.find((item) => item.productId === productId);
    const maxAllowed = cartItem ? this.getMaxAllowedQuantity(cartItem) : null;

    let nextQuantity = normalizeQuantity(Number(targetInput?.value));
    if (typeof maxAllowed === "number") {
      nextQuantity = Math.min(nextQuantity, maxAllowed);
    }

    if (targetInput) {
      targetInput.value = String(nextQuantity);
    }
    this.quantityChange.emit({ productId, quantity: nextQuantity });
  }

  handleRemoveItem(productId: string): void {
    this.removeItem.emit(productId);
  }
}

export function mountCheckoutItems(
  containerElement: HTMLElement,
  props: CheckoutItemsProps,
): () => void {
  let applicationRef: ApplicationRef | null = null;
  let componentRef: ComponentRef<CheckoutItemsComponent> | null = null;
  let isUnmounted = false;

  const syncCartItemsFromGlobalState = (): void => {
    if (!componentRef) {
      return;
    }
    componentRef.setInput("cartItems", readCartItemsFromGlobalState());
  };

  const handleGlobalCartUpdated = (): void => {
    syncCartItemsFromGlobalState();
  };

  window.addEventListener("cart:updateGlobalCart", handleGlobalCartUpdated);

  const bootstrapPromise = createApplication().then((nextApplicationRef) => {
    if (isUnmounted) {
      nextApplicationRef.destroy();
      return;
    }

    applicationRef = nextApplicationRef;
    componentRef = applicationRef.bootstrap(CheckoutItemsComponent, containerElement);
    syncCartItemsFromGlobalState();
    componentRef.setInput("productsById", props.productsById ?? {});
    componentRef.setInput("apiBaseUrl", props.apiBaseUrl ?? null);

    componentRef.instance.quantityChange.subscribe((payload) => {
      props.onQuantityChange?.(payload.productId, payload.quantity);
    });
    componentRef.instance.removeItem.subscribe((productId) => {
      props.onRemoveItem?.(productId);
    });
  });

  return () => {
    isUnmounted = true;
    window.removeEventListener("cart:updateGlobalCart", handleGlobalCartUpdated);
    void bootstrapPromise.then(() => {
      componentRef?.destroy();
      applicationRef?.destroy();
      containerElement.innerHTML = "";
    });
  };
}
