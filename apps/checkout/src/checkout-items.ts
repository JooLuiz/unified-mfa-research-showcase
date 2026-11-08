/**
 * Renders editable checkout cart items supplied by the ecommerce shell.
 * Role: Displays cart snapshots and publishes cart update/remove intents on the host mesh.
 * Not in this file: Angular bootstrap (src/checkout-items-bootstrap.ts), cart persistence, or shell-owned cart mutations.
 * Key dependencies: src/checkout-availability-watcher.ts.
 * See also: src/checkout-items-bootstrap.ts; apps/ecommerce-shell/src/pages/checkoutPage.js.
 */

import "@angular/compiler";
import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import "./styles.css";
import { CheckoutAvailabilityWatcher } from "./checkout-availability-watcher";

type Product = {
  id: string;
  name: string;
  price: number;
  image: string;
};

export type CartItem = {
  productId: string;
  quantity: number;
};

type ProductsById = Record<string, Product>;

type SubscribeToCartChanges = (
  listener: (cartItems: CartItem[]) => void,
) => () => void;

export type CheckoutItemsProps = {
  cartItems: CartItem[];
  productsById: ProductsById;
  subscribeToCartChanges: SubscribeToCartChanges;
};

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

export function normalizeCartItems(cartItems: unknown): CartItem[] {
  if (!Array.isArray(cartItems)) {
    return [];
  }

  return cartItems
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
export class CheckoutItemsComponent implements OnChanges, OnDestroy {
  @Input() cartItems: CartItem[] = [];

  @Input() productsById: ProductsById = {};

  @Output() quantityChange = new EventEmitter<{
    productId: string;
    quantity: number;
  }>();

  @Output() removeItem = new EventEmitter<string>();

  availableByProductId: Record<string, number> = {};

  private readonly availabilityWatcher = new CheckoutAvailabilityWatcher(
    (productId, nextAvailable) => {
      this.applyAvailable(productId, nextAvailable);
    },
  );

  constructor(private readonly changeDetectorRef: ChangeDetectorRef) {}

  /**
   * Records one product's available count and repaints the line.
   * @param productId - Catalog product id.
   * @param available - Units still free to reserve.
   * @sideEffects Updates the "No more available" label.
   */
  applyAvailable(productId: string, available: number): void {
    this.availableByProductId = { ...this.availableByProductId, [productId]: available };
    this.changeDetectorRef.detectChanges();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["cartItems"]) {
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

export { mountCheckoutItems } from "./checkout-items-bootstrap";
