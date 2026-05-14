import "@angular/compiler";
import {
  AfterViewInit,
  ApplicationRef,
  ChangeDetectorRef,
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
  similarProducts?: string[];
};

type AddToCartPayload = {
  productId: string;
  quantity: number;
};

type MountSimilarProductsProps = {
  title: string;
  productIds: string[];
  apiBaseUrl: string;
};

type MountSimilarProducts = (
  containerElement: HTMLElement,
  props: MountSimilarProductsProps,
) => (() => void) | void;

type ProductDetailsProps = {
  product?: Product;
  productId?: string;
  apiBaseUrl?: string;
  onAddToCart?: (payload: AddToCartPayload) => void;
  mountSimilarProducts: MountSimilarProducts;
};

const normalizeQuantity = (nextQuantity: number): number => {
  const parsedQuantity = Number(nextQuantity);
  if (!Number.isFinite(parsedQuantity) || parsedQuantity < 1) {
    return 1;
  }
  return Math.floor(parsedQuantity);
};

async function fetchProductById(
  apiBaseUrl: string,
  productId: string,
  signal: AbortSignal,
): Promise<Product> {
  const response = await fetch(`${apiBaseUrl}/products/${productId}`, { signal });
  if (!response.ok) {
    throw new Error(
      `fetchProductById - request failed: ${response.status} ${response.statusText}`,
    );
  }
  return response.json();
}

@Component({
  standalone: true,
  selector: "angular-product-details",
  imports: [CommonModule],
  template: `
    <ng-container *ngIf="isLoading; else loadedTemplate">
      <section class="pdp-shell">
        <p>Loading product details...</p>
      </section>
    </ng-container>
    <ng-template #loadedTemplate>
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
            <div class="pdp-quantity-shell">
              <button class="pdp-quantity-control-button" type="button" (click)="decreaseQuantity()">-</button>
              <input
                class="pdp-quantity-value-input"
                type="number"
                min="1"
                [value]="quantityValue"
                (change)="handleQuantityChange($event)"
              />
              <button class="pdp-quantity-control-button" type="button" (click)="increaseQuantity()">+</button>
            </div>
            <button class="pdp-add-to-cart-button" type="button" (click)="handleAddToCart()">
              Add to Cart
            </button>
          </div>
        </section>
        <section #similarProductsMount></section>
      </ng-container>
    </ng-template>

    <ng-template #productNotFoundTemplate>
      <section class="pdp-shell">
        <p>Product not found.</p>
      </section>
    </ng-template>
  `,
})
class ProductDetailsComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() inputProduct: Product | null = null;

  @Input() productId: string | null = null;

  @Input() apiBaseUrl: string | null = null;

  @Input() mountSimilarProducts?: MountSimilarProducts;

  @Output() addToCart = new EventEmitter<AddToCartPayload>();

  @ViewChild("similarProductsMount")
  similarProductsMountRef?: ElementRef<HTMLElement>;

  product: Product | null = null;

  isLoading = false;

  quantityValue = 1;

  private hasViewInitialized = false;

  private cleanupSimilarProducts?: () => void;

  private activeAbortController?: AbortController;

  private lastLoadedProductId?: string;

  private lastLoadedApiBaseUrl?: string;

  constructor(private readonly changeDetectorRef: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    this.hasViewInitialized = true;
    this.renderSimilarProducts();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["productId"] || changes["inputProduct"]) {
      this.quantityValue = 1;
    }

    this.loadProductIfNeeded();
  }

  ngOnDestroy(): void {
    this.cleanupSimilarProductsView();
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = undefined;
    }
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

  private loadProductIfNeeded(): void {
    if (this.inputProduct) {
      if (this.activeAbortController) {
        this.activeAbortController.abort();
        this.activeAbortController = undefined;
      }
      this.product = this.inputProduct;
      this.isLoading = false;
      this.lastLoadedProductId = undefined;
      this.lastLoadedApiBaseUrl = undefined;
      if (this.hasViewInitialized) {
        queueMicrotask(() => this.renderSimilarProducts());
      }
      return;
    }

    const currentProductId = this.productId;
    const currentApiBaseUrl = this.apiBaseUrl;

    if (!currentProductId || !currentApiBaseUrl) {
      this.product = null;
      this.isLoading = false;
      this.lastLoadedProductId = undefined;
      this.lastLoadedApiBaseUrl = undefined;
      if (this.hasViewInitialized) {
        queueMicrotask(() => this.renderSimilarProducts());
      }
      return;
    }

    if (
      this.lastLoadedProductId === currentProductId &&
      this.lastLoadedApiBaseUrl === currentApiBaseUrl
    ) {
      return;
    }

    this.lastLoadedProductId = currentProductId;
    this.lastLoadedApiBaseUrl = currentApiBaseUrl;

    if (this.activeAbortController) {
      this.activeAbortController.abort();
    }

    const abortController = new AbortController();
    this.activeAbortController = abortController;
    this.isLoading = true;
    this.product = null;
    this.cleanupSimilarProductsView();

    fetchProductById(currentApiBaseUrl, currentProductId, abortController.signal)
      .then((fetchedProduct) => {
        if (abortController.signal.aborted) {
          return;
        }
        this.product = fetchedProduct;
        this.isLoading = false;
        this.changeDetectorRef.detectChanges();
        if (this.hasViewInitialized) {
          queueMicrotask(() => this.renderSimilarProducts());
        }
      })
      .catch((error: Error) => {
        if (error.name === "AbortError") {
          return;
        }
        console.warn("loadProductIfNeeded - error");
        console.warn(error);
        this.product = null;
        this.isLoading = false;
        this.changeDetectorRef.detectChanges();
      });
  }

  private renderSimilarProducts(): void {
    this.cleanupSimilarProductsView();

    if (
      !this.mountSimilarProducts ||
      !this.similarProductsMountRef?.nativeElement ||
      !this.apiBaseUrl ||
      !this.product
    ) {
      return;
    }

    const similarProductIds = Array.isArray(this.product.similarProducts)
      ? this.product.similarProducts
      : [];

    if (similarProductIds.length === 0) {
      return;
    }

    const cleanupValue = this.mountSimilarProducts(
      this.similarProductsMountRef.nativeElement,
      {
        title: "Similar Products Showcase",
        productIds: similarProductIds,
        apiBaseUrl: this.apiBaseUrl,
      },
    );

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
    componentRef.setInput("inputProduct", props.product ?? null);
    componentRef.setInput("productId", props.productId ?? null);
    componentRef.setInput("apiBaseUrl", props.apiBaseUrl ?? null);
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
