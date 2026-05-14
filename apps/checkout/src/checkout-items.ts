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
import "./styles.css";

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
  cartItems: CartItem[];
  productsById: ProductsById;
  onQuantityChange?: (productId: string, quantity: number) => void;
  onRemoveItem?: (productId: string) => void;
};

const normalizeQuantity = (nextQuantity: number): number => {
  const parsedQuantity = Number(nextQuantity);
  if (!Number.isFinite(parsedQuantity) || parsedQuantity < 1) {
    return 1;
  }
  return Math.floor(parsedQuantity);
};

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

  const bootstrapPromise = createApplication().then((nextApplicationRef) => {
    if (isUnmounted) {
      nextApplicationRef.destroy();
      return;
    }

    applicationRef = nextApplicationRef;
    componentRef = applicationRef.bootstrap(CheckoutItemsComponent, containerElement);
    componentRef.setInput("cartItems", props.cartItems ?? []);
    componentRef.setInput("productsById", props.productsById ?? {});

    componentRef.instance.quantityChange.subscribe((payload) => {
      props.onQuantityChange?.(payload.productId, payload.quantity);
    });
    componentRef.instance.removeItem.subscribe((productId) => {
      props.onRemoveItem?.(productId);
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
