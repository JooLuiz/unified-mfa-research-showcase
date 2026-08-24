/**
 * Angular component behind the product details page.
 * Role: Owns product display state (loading, missing id, quantity) and the similar-products mount lifecycle.
 * Not in this file: Product HTTP and abort bookkeeping (src/product-loader.ts) or the mount adapter
 *   (src/product-details-adapter.ts).
 * Key dependencies: src/product-details.types.ts.
 * See also: src/product-details-adapter.ts (host-facing mount API).
 */

import "@angular/compiler";
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
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
import "./styles.css";
import type {
  AddToCartPayload,
  MountSimilarProducts,
  Product,
} from "./product-details.types";
import {
  fetchProductById,
  ProductRequestTracker,
  readProductIdFromQueryParams,
} from "./product-loader";

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
        <p *ngIf="isMissingProductId; else missingProductTemplate">
          No product id was provided.
        </p>
        <ng-template #missingProductTemplate>
          <p>Product not found.</p>
        </ng-template>
      </section>
    </ng-template>
  `,
})
export class ProductDetailsComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() inputProduct: Product | null = null;

  @Input() apiBaseUrl: string | null = null;

  @Input() mountSimilarProducts?: MountSimilarProducts;

  @Output() addToCart = new EventEmitter<AddToCartPayload>();

  @ViewChild("similarProductsMount")
  similarProductsMountRef?: ElementRef<HTMLElement>;

  product: Product | null = null;

  isLoading = false;

  isMissingProductId = false;

  quantityValue = 1;

  private hasViewInitialized = false;

  private cleanupSimilarProducts?: () => void;

  private readonly requestTracker = new ProductRequestTracker();

  constructor(private readonly changeDetectorRef: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    this.hasViewInitialized = true;
    this.renderSimilarProducts();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["inputProduct"]) {
      this.quantityValue = 1;
    }

    this.loadProductIfNeeded();
  }

  ngOnDestroy(): void {
    this.cleanupSimilarProductsView();
    this.requestTracker.abort();
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
      this.requestTracker.abort();
      this.requestTracker.reset();
      this.product = this.inputProduct;
      this.isLoading = false;
      this.isMissingProductId = false;
      if (this.hasViewInitialized) {
        queueMicrotask(() => this.renderSimilarProducts());
      }
      return;
    }

    const currentProductId = readProductIdFromQueryParams();
    const currentApiBaseUrl = this.apiBaseUrl;

    if (!currentProductId || !currentApiBaseUrl) {
      this.product = null;
      this.isLoading = false;
      this.isMissingProductId = !currentProductId;
      this.requestTracker.reset();
      if (this.hasViewInitialized) {
        queueMicrotask(() => this.renderSimilarProducts());
      }
      return;
    }

    if (this.requestTracker.hasLoaded(currentProductId, currentApiBaseUrl)) {
      return;
    }

    const abortController = this.requestTracker.begin(currentProductId, currentApiBaseUrl);
    this.isLoading = true;
    this.product = null;
    this.isMissingProductId = false;
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
