import "@angular/compiler";
import {
  AfterViewInit,
  ApplicationRef,
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

type MountProductCardProps = {
  product: Product;
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
  products?: Product[];
  title?: string;
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

@Component({
  standalone: true,
  selector: customElementName,
  imports: [CommonModule],
  template: `
    <section class="showcase-shell">
      <h3>{{ title }}</h3>
      <div class="showcase-grid">
        <div #productSlot *ngFor="let product of products; trackBy: trackByProductId"></div>
      </div>
    </section>
  `,
})
class ProductShowcaseElementComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() config: ProductShowcaseConfiguration = {};

  @ViewChildren("productSlot")
  productSlots?: QueryList<ElementRef<HTMLElement>>;

  private slotChangesSubscription?: Subscription;
  private cardCleanupFunctions: Array<() => void> = [];
  private hasViewInitialized = false;
  private isRenderScheduled = false;

  get products(): Product[] {
    return Array.isArray(this.config.products) ? this.config.products : [];
  }

  get title(): string {
    return this.config.title || "Showcase Title";
  }

  trackByProductId(_index: number, product: Product): string {
    return product.id;
  }

  ngAfterViewInit(): void {
    this.hasViewInitialized = true;
    this.slotChangesSubscription = this.productSlots?.changes.subscribe(() => {
      this.scheduleRenderCards();
    });
    this.scheduleRenderCards();
  }

  ngOnChanges(_changes: SimpleChanges): void {
    if (!this.hasViewInitialized) {
      return;
    }
    this.scheduleRenderCards();
  }

  ngOnDestroy(): void {
    this.slotChangesSubscription?.unsubscribe();
    this.cleanupCardMounts();
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
    if (typeof mountProductCard !== "function") {
      return;
    }

    const slotElements = this.productSlots.toArray();
    slotElements.forEach((slotElementRef, index) => {
      const product = this.products[index];
      if (!product) {
        return;
      }

      const cleanupValue = mountProductCard(slotElementRef.nativeElement, {
        product,
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
