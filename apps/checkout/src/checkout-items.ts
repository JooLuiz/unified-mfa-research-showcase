/**
 * Renders editable checkout cart items supplied by the ecommerce shell.
 * Role: Displays cart snapshots and publishes cart update/remove intents on the host mesh.
 * Not in this file: Cart persistence, Event Mesh configuration, or shell-owned cart mutations.
 * Key dependencies: Host-provided cart snapshot and cart-change subscription; event-mesh/mesh; @shared/catalog-events.
 * See also: apps/ecommerce-shell/src/pages/checkoutPage.js; MESH_IMPLEMENTATIONS/remote-intents.md.
 */

import "@angular/compiler";
import {
  ApplicationRef,
  Component,
  ComponentRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { createApplication } from "@angular/platform-browser";
import mesh from "event-mesh/mesh";
import { createCatalogEvents } from "@shared/catalog-events";
import "./styles.css";

const { publishCartItemUpdateRequested, publishCartItemRemoveRequested } =
  createCatalogEvents({ mesh });

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

type SubscribeToCartChanges = (
  listener: (cartItems: CartItem[]) => void,
) => () => void;

type CheckoutItemsProps = {
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

function normalizeCartItems(cartItems: unknown): CartItem[] {
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
              [value]="cartItem.quantity"
              (change)="handleQuantityChange($event, cartItem.productId)"
            />
            <button
              class="checkout-quantity-button"
              type="button"
              (click)="handleIncreaseQuantity(cartItem)"
            >
              +
            </button>
          </div>
        </ng-container>
      </article>
    </section>
  `,
})
class CheckoutItemsComponent implements OnChanges {
  @Input() cartItems: CartItem[] = [];

  @Input() productsById: ProductsById = {};

  @Output() quantityChange = new EventEmitter<{
    productId: string;
    quantity: number;
  }>();

  @Output() removeItem = new EventEmitter<string>();

  ngOnChanges(_changes: SimpleChanges): void {
    // Inputs are reflected automatically; no extra work needed.
  }

  trackByProductId(_index: number, cartItem: CartItem): string {
    return cartItem.productId;
  }

  handleDecreaseQuantity(cartItem: CartItem): void {
    const nextQuantity = Math.max(cartItem.quantity - 1, 1);
    this.quantityChange.emit({
      productId: cartItem.productId,
      quantity: nextQuantity,
    });
  }

  handleIncreaseQuantity(cartItem: CartItem): void {
    this.quantityChange.emit({
      productId: cartItem.productId,
      quantity: cartItem.quantity + 1,
    });
  }

  handleQuantityChange(event: Event, productId: string): void {
    const targetInput = event.target as HTMLInputElement | null;
    const nextQuantity = normalizeQuantity(Number(targetInput?.value));
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

  const syncCartItems = (cartItems: CartItem[]): void => {
    if (!componentRef) {
      return;
    }
    componentRef.setInput("cartItems", normalizeCartItems(cartItems));
  };

  const unsubscribeFromCartChanges = props.subscribeToCartChanges(syncCartItems);

  const bootstrapPromise = createApplication().then((nextApplicationRef) => {
    if (isUnmounted) {
      nextApplicationRef.destroy();
      return;
    }

    applicationRef = nextApplicationRef;
    componentRef = applicationRef.bootstrap(CheckoutItemsComponent, containerElement);
    syncCartItems(props.cartItems);
    componentRef.setInput("productsById", props.productsById ?? {});

    componentRef.instance.quantityChange.subscribe((payload) => {
      publishCartItemUpdateRequested({
        productId: payload.productId,
        quantity: payload.quantity,
      });
    });
    componentRef.instance.removeItem.subscribe((productId) => {
      publishCartItemRemoveRequested(productId);
    });
  });

  return () => {
    isUnmounted = true;
    unsubscribeFromCartChanges();
    void bootstrapPromise.then(() => {
      componentRef?.destroy();
      applicationRef?.destroy();
      containerElement.innerHTML = "";
    });
  };
}
