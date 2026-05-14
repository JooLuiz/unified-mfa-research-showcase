import "@angular/compiler";
import {
  AfterViewInit,
  ApplicationRef,
  ChangeDetectorRef,
  Component,
  ElementRef,
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

type Showcase = {
  id: string;
  showcaseTitle: string;
  productIds: string[];
};

type AddToCartPayload = {
  productId: string;
  quantity: number;
};

type MountProductCardProps = {
  productId: string;
  apiBaseUrl: string;
  actionLabel?: string;
  hideQuantity?: boolean;
  onProductClick?: (productId: string) => void;
  onAddToCart?: (payload: AddToCartPayload) => void;
};

type MountProductCard = (
  containerElement: HTMLElement,
  props: MountProductCardProps,
) => (() => void) | void;

type ProductShowcaseConfiguration = {
  showcaseId?: string;
  productIds?: string[];
  title?: string;
  apiBaseUrl?: string;
  fallbackTitle?: string;
  actionLabel?: string;
  hideQuantity?: boolean;
  mountProductCard?: MountProductCard;
  onProductClick?: (productId: string) => void;
  onAddToCart?: (payload: AddToCartPayload) => void;
};

type ProductShowcaseElementInstance = HTMLElement & {
  config?: ProductShowcaseConfiguration;
};

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
      <h3>{{ titleText }}</h3>
      <ng-container *ngIf="isLoading; else loadedTemplate">
        <p>Loading showcase...</p>
      </ng-container>
      <ng-template #loadedTemplate>
        <ng-container *ngIf="!hasLoadError; else errorTemplate">
          <div class="showcase-grid">
            <div
              #productSlot
              *ngFor="let productId of productIds; trackBy: trackByProductId"
            ></div>
          </div>
        </ng-container>
        <ng-template #errorTemplate>
          <p>Unable to load showcase.</p>
        </ng-template>
      </ng-template>
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

  private slotChangesSubscription?: Subscription;
  private cardCleanupFunctions: Array<() => void> = [];
  private hasViewInitialized = false;
  private isRenderScheduled = false;
  private activeAbortController?: AbortController;
  private lastLoadedShowcaseId?: string;
  private lastLoadedApiBaseUrl?: string;

  constructor(private readonly changeDetectorRef: ChangeDetectorRef) {}

  get productIds(): string[] {
    if (Array.isArray(this.config.productIds) && this.config.productIds.length > 0) {
      return this.config.productIds;
    }
    return Array.isArray(this.showcaseData?.productIds)
      ? this.showcaseData!.productIds
      : [];
  }

  get titleText(): string {
    return (
      this.config.title ||
      this.showcaseData?.showcaseTitle ||
      this.config.fallbackTitle ||
      "Showcase"
    );
  }

  trackByProductId(_index: number, productId: string): string {
    return productId;
  }

  ngAfterViewInit(): void {
    this.hasViewInitialized = true;
    this.slotChangesSubscription = this.productSlots?.changes.subscribe(() => {
      this.scheduleRenderCards();
    });
    this.scheduleRenderCards();
  }

  ngOnChanges(_changes: SimpleChanges): void {
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
    const hasDirectProductIds =
      Array.isArray(this.config.productIds) && this.config.productIds.length > 0;

    if (hasDirectProductIds || !showcaseId || !apiBaseUrl) {
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
      this.renderCards();
    });
  }

  private renderCards(): void {
    this.cleanupCardMounts();

    if (!this.productSlots) {
      return;
    }

    const mountProductCard = this.config.mountProductCard;
    const apiBaseUrl = this.config.apiBaseUrl;
    if (typeof mountProductCard !== "function" || !apiBaseUrl) {
      return;
    }

    const slotElements = this.productSlots.toArray();
    slotElements.forEach((slotElementRef, index) => {
      const productId = this.productIds[index];
      if (!productId) {
        return;
      }

      const cleanupValue = mountProductCard(slotElementRef.nativeElement, {
        productId,
        apiBaseUrl,
        actionLabel: this.config.actionLabel,
        hideQuantity: this.config.hideQuantity,
        onProductClick: this.config.onProductClick,
        onAddToCart: this.config.onAddToCart,
      });

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
