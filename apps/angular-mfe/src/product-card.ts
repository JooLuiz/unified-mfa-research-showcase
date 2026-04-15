import "@angular/compiler";
import {
  ApplicationRef,
  Component,
  ComponentRef,
  EventEmitter,
  Input,
  Output,
} from "@angular/core";
import { createApplication } from "@angular/platform-browser";
import "./styles.css";

type Product = {
  id: string;
  name: string;
  price: number;
  image: string;
};

type AddToCartPayload = {
  productId: string;
  quantity: number;
};

type ProductCardProps = {
  product: Product;
  defaultQuantity?: number;
  onProductClick?: (productId: string) => void;
  onAddToCart?: (payload: AddToCartPayload) => void;
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
  selector: "angular-product-card",
  template: `
    <article class="card-shell">
      <img
        class="product-image-clickable"
        [src]="product.image"
        [alt]="product.name"
        (click)="handleProductClick()"
      />
      <strong class="product-name">{{ product.name }}</strong>
      <span>\${{ product.price.toFixed(2) }}</span>
      <div class="quantity-shell">
        <button class="quantity-control-button" type="button" (click)="decreaseQuantity()">-</button>
        <input
          class="quantity-value-input"
          type="number"
          min="1"
          [value]="quantityValue"
          (change)="handleQuantityChange($event)"
        />
        <button class="quantity-control-button" type="button" (click)="increaseQuantity()">+</button>
      </div>
      <button class="button-like add-cart-button" type="button" (click)="handleAddToCart()">
        Add to Cart
      </button>
    </article>
  `,
})
class ProductCardComponent {
  @Input() product: Product = {
    id: "",
    name: "",
    price: 0,
    image: "",
  };

  @Input() quantityValue = 1;

  @Output() productClick = new EventEmitter<string>();

  @Output() addToCart = new EventEmitter<AddToCartPayload>();

  decreaseQuantity(): void {
    this.quantityValue = Math.max(this.quantityValue - 1, 1);
  }

  increaseQuantity(): void {
    this.quantityValue += 1;
  }

  handleQuantityChange(event: Event): void {
    const targetInput = event.target as HTMLInputElement | null;
    this.quantityValue = normalizeQuantity(Number(targetInput?.value));
    if (targetInput) {
      targetInput.value = String(this.quantityValue);
    }
  }

  handleProductClick(): void {
    this.productClick.emit(this.product.id);
  }

  handleAddToCart(): void {
    this.addToCart.emit({
      productId: this.product.id,
      quantity: this.quantityValue,
    });
  }
}

export function mountProductCard(containerElement: HTMLElement, props: ProductCardProps): () => void {
  let applicationRef: ApplicationRef | null = null;
  let componentRef: ComponentRef<ProductCardComponent> | null = null;
  let isUnmounted = false;

  const bootstrapPromise = createApplication().then((nextApplicationRef) => {
    if (isUnmounted) {
      nextApplicationRef.destroy();
      return;
    }

    applicationRef = nextApplicationRef;
    componentRef = applicationRef.bootstrap(ProductCardComponent, containerElement);
    componentRef.setInput("product", props.product);
    componentRef.setInput("quantityValue", normalizeQuantity(props.defaultQuantity ?? 1));

    componentRef.instance.productClick.subscribe((productId) => {
      props.onProductClick?.(productId);
    });

    componentRef.instance.addToCart.subscribe((payload) => {
      props.onAddToCart?.(payload);
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
