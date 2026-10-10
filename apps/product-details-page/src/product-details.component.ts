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
import { ProductAvailabilityWatcher } from "./product-availability-watcher";
import { PRODUCT_DETAILS_TEMPLATE } from "./product-details.template";

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
  template: PRODUCT_DETAILS_TEMPLATE,
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

  availableCount: number | null = null;

  private hasViewInitialized = false;

  private cleanupSimilarProducts?: () => void;

  private readonly requestTracker = new ProductRequestTracker();

  private readonly availabilityWatcher = new ProductAvailabilityWatcher((nextAvailable) => {
    this.availableCount = nextAvailable;
    if (nextAvailable > 0 && this.quantityValue > nextAvailable) {
      this.quantityValue = nextAvailable;
    }
    this.changeDetectorRef.detectChanges();
  });

  get isOutOfStock(): boolean {
    return this.availableCount === 0;
  }

  get isAtMaxQuantity(): boolean {
    return typeof this.availableCount === "number" && this.quantityValue >= this.availableCount;
  }

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
    this.availabilityWatcher.stopWatching();
    this.requestTracker.abort();
  }

  decreaseQuantity(): void {
    this.quantityValue = Math.max(this.quantityValue - 1, 1);
  }

  increaseQuantity(): void {
    const maxAllowed = this.availableCount;
    this.quantityValue =
      typeof maxAllowed === "number"
        ? Math.min(this.quantityValue + 1, maxAllowed)
        : this.quantityValue + 1;
  }

  handleQuantityChange(event: Event): void {
    const targetInput = event.target as HTMLInputElement | null;
    const maxAllowed = this.availableCount;
    let nextQuantity = normalizeQuantity(Number(targetInput?.value));
    if (typeof maxAllowed === "number") {
      nextQuantity = Math.min(nextQuantity, maxAllowed);
    }
    this.quantityValue = nextQuantity;
    if (targetInput) {
      targetInput.value = String(nextQuantity);
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
      this.availableCount = this.availabilityWatcher.startWatching(this.product);
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
      this.availableCount = this.availabilityWatcher.startWatching(null);
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
        this.availableCount = this.availabilityWatcher.startWatching(this.product);
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
        this.availableCount = this.availabilityWatcher.startWatching(null);
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
