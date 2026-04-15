import "@angular/compiler";
import {
  AfterViewInit,
  ApplicationRef,
  Component,
  ComponentRef,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
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

type AddToCartPayload = {
  productId: string;
  quantity: number;
};

type MountProductShowcaseProps = {
  title: string;
  products: Product[];
};

type MountProductShowcase = (
  containerElement: HTMLElement,
  props: MountProductShowcaseProps,
) => (() => void) | void;

type ProductDetailsProps = {
  product?: Product;
  similarProducts?: Product[];
  onAddToCart?: (payload: AddToCartPayload) => void;
  mountSimilarProducts: MountProductShowcase;
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
  selector: "angular-product-details",
  imports: [CommonModule],
  template: `
    <ng-container *ngIf="product; else productNotFoundTemplate">
      <section class="pdp-shell">
        <div>
          <img [src]="product.image" [alt]="product.name" />
        </div>
        <div class="pdp-details-column">
          <h2>{{ product.name }}</h2>
          <div>
            <p>Price: \${{ product.price.toFixed(2) }}</p>
          </div>
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
          <button class="button-like pdp-add-to-cart-button" type="button" (click)="handleAddToCart()">
            Add to Cart
          </button>
        </div>
      </section>
      <section #similarProductsMount></section>
    </ng-container>

    <ng-template #productNotFoundTemplate>
      <section class="pdp-shell">
        <p>Product not found.</p>
      </section>
    </ng-template>
  `,
})
class ProductDetailsComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() product: Product | null = null;

  @Input() similarProducts: Product[] = [];

  @Input() mountSimilarProducts?: MountProductShowcase;

  @Output() addToCart = new EventEmitter<AddToCartPayload>();

  @ViewChild("similarProductsMount")
  similarProductsMountRef?: ElementRef<HTMLElement>;

  quantityValue = 1;

  private hasViewInitialized = false;

  private cleanupSimilarProducts?: () => void;

  ngAfterViewInit(): void {
    this.hasViewInitialized = true;
    this.renderSimilarProducts();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["product"]) {
      this.quantityValue = 1;
    }

    if (this.hasViewInitialized) {
      queueMicrotask(() => {
        this.renderSimilarProducts();
      });
    }
  }

  ngOnDestroy(): void {
    this.cleanupSimilarProductsView();
  }

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

  handleAddToCart(): void {
    if (!this.product) {
      return;
    }

    this.addToCart.emit({
      productId: this.product.id,
      quantity: this.quantityValue,
    });
  }

  private renderSimilarProducts(): void {
    this.cleanupSimilarProductsView();

    if (!this.mountSimilarProducts || !this.similarProductsMountRef?.nativeElement) {
      return;
    }

    const cleanupValue = this.mountSimilarProducts(this.similarProductsMountRef.nativeElement, {
      title: "Similar Products Showcase",
      products: this.similarProducts,
    });

    if (typeof cleanupValue === "function") {
      this.cleanupSimilarProducts = cleanupValue;
    }
  }

  private cleanupSimilarProductsView(): void {
    if (!this.cleanupSimilarProducts) {
      return;
    }

    this.cleanupSimilarProducts();
    this.cleanupSimilarProducts = undefined;
  }
}

export function mountProductDetails(
  containerElement: HTMLElement,
  props: ProductDetailsProps,
): () => void {
  let applicationRef: ApplicationRef | null = null;
  let componentRef: ComponentRef<ProductDetailsComponent> | null = null;
  let isUnmounted = false;

  const bootstrapPromise = createApplication().then((nextApplicationRef) => {
    if (isUnmounted) {
      nextApplicationRef.destroy();
      return;
    }

    applicationRef = nextApplicationRef;
    componentRef = applicationRef.bootstrap(ProductDetailsComponent, containerElement);
    componentRef.setInput("product", props.product ?? null);
    componentRef.setInput("similarProducts", props.similarProducts ?? []);
    componentRef.setInput("mountSimilarProducts", props.mountSimilarProducts);

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
