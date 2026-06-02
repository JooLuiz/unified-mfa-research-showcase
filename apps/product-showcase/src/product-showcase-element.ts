import "@angular/compiler";
import {
  AfterViewInit,
  ApplicationRef,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostBinding,
  Injector,
  Input,
  OnChanges,
  OnDestroy,
  QueryList,
  SimpleChanges,
  ViewChildren,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { createCustomElement } from "@angular/elements";
import { createApplication } from "@angular/platform-browser";
import { Subscription } from "rxjs";
import "./styles.css";
import type {
  MountProductCard,
  MountProductCardProps,
  Product,
  ProductShowcaseConfiguration,
  ProductShowcaseElementInstance,
  Showcase,
} from "./showcase-types";

const customElementName = "angular-product-showcase";

let showcaseElementsApplicationPromise: Promise<ApplicationRef> | null = null;
let showcaseRegistrationPromise: Promise<void> | null = null;

const getShowcaseElementsApplication = (): Promise<ApplicationRef> => {
  if (!showcaseElementsApplicationPromise) {
    showcaseElementsApplicationPromise = createApplication();
  }
  return showcaseElementsApplicationPromise;
};

async function fetchShowcaseById(
  apiBaseUrl: string,
  showcaseId: string,
  signal: AbortSignal,
): Promise<Showcase> {
  const response = await fetch(`${apiBaseUrl}/showcases/${showcaseId}`, { signal });
  if (!response.ok) {
    throw new Error(
      `fetchShowcaseById - request failed: ${response.status} ${response.statusText}`,
    );
  }
  return response.json();
}

@Component({
  standalone: true,
  selector: customElementName,
  imports: [CommonModule],
  template: `
    <section class="showcase-shell">
      <div class="showcase-header">
        <h3>{{ titleText }}</h3>
        <button
          *ngIf="isModal"
          type="button"
          class="showcase-collapse-toggle"
          (click)="toggleCollapsed()"
        >
          {{ isCollapsed ? "Show" : "Hide" }}
        </button>
      </div>
      <div
        class="showcase-body"
        [class.showcase-body--collapsed]="isModal && isCollapsed"
      >
        <ng-container *ngIf="isLoading; else loadedTemplate">
          <p>Loading showcase...</p>
        </ng-container>
        <ng-template #loadedTemplate>
          <ng-container *ngIf="!hasLoadError; else errorTemplate">
            <div class="showcase-grid">
              <div
                #productSlot
                *ngFor="let slotKey of slotKeys; trackBy: trackBySlotKey"
              ></div>
            </div>
          </ng-container>
          <ng-template #errorTemplate>
            <p>Unable to load showcase.</p>
          </ng-template>
        </ng-template>
      </div>
    </section>
  `,
})
class ProductShowcaseElementComponent
  implements AfterViewInit, OnChanges, OnDestroy
{
  @Input() config: ProductShowcaseConfiguration = {};

  @ViewChildren("productSlot")
  productSlots?: QueryList<ElementRef<HTMLElement>>;

  showcaseData: Showcase | null = null;
  isLoading = false;
  hasLoadError = false;
  isCollapsed = false;

  private hasInitializedCollapsedState = false;

  private slotChangesSubscription?: Subscription;
  private cardCleanupFunctions: Array<() => void> = [];
  private hasViewInitialized = false;
  private isRenderScheduled = false;
  private activeAbortController?: AbortController;
  private lastLoadedShowcaseId?: string;
  private lastLoadedApiBaseUrl?: string;

  constructor(private readonly changeDetectorRef: ChangeDetectorRef) {}

  @HostBinding("class.product-showcase--modal")
  get isModal(): boolean {
    return this.config.displayMode === "modal";
  }

  toggleCollapsed(): void {
    this.isCollapsed = !this.isCollapsed;
  }

  get fullProducts(): Product[] {
    return Array.isArray(this.config.products) ? this.config.products : [];
  }

  get productIds(): string[] {
    if (this.fullProducts.length > 0) {
      return this.fullProducts.map((product) => product.id);
    }
    if (Array.isArray(this.config.productIds) && this.config.productIds.length > 0) {
      return this.config.productIds;
    }
    const showcaseSource = this.config.showcase || this.showcaseData;
    return Array.isArray(showcaseSource?.productIds)
      ? showcaseSource!.productIds
      : [];
  }

  get slotKeys(): string[] {
    const fullProducts = this.fullProducts;
    if (fullProducts.length > 0) {
      return fullProducts.map((product) => product.id);
    }
    return this.productIds;
  }

  get titleText(): string {
    return (
      this.config.title ||
      this.config.showcase?.showcaseTitle ||
      this.showcaseData?.showcaseTitle ||
      this.config.fallbackTitle ||
      "Showcase"
    );
  }

  trackBySlotKey(_index: number, slotKey: string): string {
    return slotKey;
  }

  ngAfterViewInit(): void {
    this.hasViewInitialized = true;
    this.slotChangesSubscription = this.productSlots?.changes.subscribe(() => {
      this.scheduleRenderCards();
    });
    this.scheduleRenderCards();
  }

  ngOnChanges(_changes: SimpleChanges): void {
    if (!this.hasInitializedCollapsedState) {
      this.isCollapsed = Boolean(this.config.defaultCollapsed);
      this.hasInitializedCollapsedState = true;
    }

    this.loadShowcaseIfNeeded();

    if (!this.hasViewInitialized) {
      return;
    }
    this.scheduleRenderCards();
  }

  ngOnDestroy(): void {
    this.slotChangesSubscription?.unsubscribe();
    this.cleanupCardMounts();
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = undefined;
    }
  }

  private loadShowcaseIfNeeded(): void {
    const showcaseId = this.config.showcaseId;
    const apiBaseUrl = this.config.apiBaseUrl;
    const hasDirectProducts =
      Array.isArray(this.config.products) && this.config.products.length > 0;
    const hasDirectProductIds =
      Array.isArray(this.config.productIds) && this.config.productIds.length > 0;
    const hasDirectShowcase = Boolean(this.config.showcase);

    if (
      hasDirectProducts ||
      hasDirectProductIds ||
      hasDirectShowcase ||
      !showcaseId ||
      !apiBaseUrl
    ) {
      this.showcaseData = null;
      this.isLoading = false;
      this.hasLoadError = false;
      this.lastLoadedShowcaseId = undefined;
      this.lastLoadedApiBaseUrl = undefined;
      return;
    }

    if (
      this.lastLoadedShowcaseId === showcaseId &&
      this.lastLoadedApiBaseUrl === apiBaseUrl
    ) {
      return;
    }

    this.lastLoadedShowcaseId = showcaseId;
    this.lastLoadedApiBaseUrl = apiBaseUrl;

    if (this.activeAbortController) {
      this.activeAbortController.abort();
    }

    const abortController = new AbortController();
    this.activeAbortController = abortController;
    this.isLoading = true;
    this.hasLoadError = false;

    fetchShowcaseById(apiBaseUrl, showcaseId, abortController.signal)
      .then((fetchedShowcase) => {
        if (abortController.signal.aborted) {
          return;
        }
        this.showcaseData = fetchedShowcase;
        this.isLoading = false;
        this.changeDetectorRef.detectChanges();
        this.scheduleRenderCards();
      })
      .catch((error: Error) => {
        if (error.name === "AbortError") {
          return;
        }
        console.warn("loadShowcaseIfNeeded - error");
        console.warn(error);
        this.hasLoadError = true;
        this.showcaseData = null;
        this.isLoading = false;
        this.changeDetectorRef.detectChanges();
      });
  }

  private scheduleRenderCards(): void {
    if (this.isRenderScheduled) {
      return;
    }

    this.isRenderScheduled = true;
    queueMicrotask(() => {
      this.isRenderScheduled = false;
      void this.renderCards();
    });
  }

  private async resolveMountProductCard(): Promise<MountProductCard | null> {
    if (typeof this.config.mountProductCard === "function") {
      return this.config.mountProductCard;
    }

    try {
      const productCardModule = await import("product_card/ProductCard");
      return productCardModule.mountProductCard;
    } catch (importError) {
      console.warn("resolveMountProductCard - importError");
      console.warn(importError);
      return null;
    }
  }

  private async renderCards(): Promise<void> {
    this.cleanupCardMounts();

    if (!this.productSlots) {
      return;
    }

    const mountProductCard = await this.resolveMountProductCard();
    if (typeof mountProductCard !== "function") {
      return;
    }

    const fullProducts = this.fullProducts;
    const hasFullProducts = fullProducts.length > 0;
    const apiBaseUrl = this.config.apiBaseUrl;

    if (!hasFullProducts && !apiBaseUrl) {
      return;
    }

    const slotElements = this.productSlots.toArray();
    slotElements.forEach((slotElementRef, index) => {
      const cardProps: MountProductCardProps = {
        actionLabel: this.config.actionLabel,
        hideQuantity: this.config.hideQuantity,
        variant: this.isModal ? "compact" : "default",
        onProductClick: this.config.onProductClick,
        onAddToCart: this.config.onAddToCart,
      };

      if (hasFullProducts) {
        const product = fullProducts[index];
        if (!product) {
          return;
        }
        cardProps.product = product;
      } else {
        const productId = this.productIds[index];
        if (!productId) {
          return;
        }
        cardProps.productId = productId;
        cardProps.apiBaseUrl = apiBaseUrl;
      }

      const cleanupValue = mountProductCard(slotElementRef.nativeElement, cardProps);

      if (typeof cleanupValue === "function") {
        this.cardCleanupFunctions.push(cleanupValue);
      }
    });
  }

  private cleanupCardMounts(): void {
    this.cardCleanupFunctions.forEach((cleanupFunction) => {
      cleanupFunction();
    });
    this.cardCleanupFunctions = [];
  }
}

const ensureProductShowcaseElementRegistered = (): Promise<void> => {
  if (customElements.get(customElementName)) {
    return Promise.resolve();
  }

  if (!showcaseRegistrationPromise) {
    showcaseRegistrationPromise = getShowcaseElementsApplication().then((applicationRef) => {
      if (customElements.get(customElementName)) {
        return;
      }

      const customElementConstructor = createCustomElement(ProductShowcaseElementComponent, {
        injector: applicationRef.injector as Injector,
      });
      customElements.define(customElementName, customElementConstructor);
    });
  }

  return showcaseRegistrationPromise;
};

export function registerProductShowcaseElement(): void {
  void ensureProductShowcaseElementRegistered();
}

export function mountProductShowcase(
  containerElement: HTMLElement,
  props: ProductShowcaseConfiguration,
): () => void {
  let isUnmounted = false;

  const mountPromise = ensureProductShowcaseElementRegistered().then(() => {
    if (isUnmounted) {
      return;
    }

    const showcaseElement = document.createElement(customElementName) as ProductShowcaseElementInstance;
    containerElement.appendChild(showcaseElement);
    showcaseElement.config = props;
  });

  return () => {
    isUnmounted = true;
    void mountPromise.finally(() => {
      containerElement.innerHTML = "";
    });
  };
}
