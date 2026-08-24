/**
 * Angular component behind the angular-product-showcase custom element.
 * Role: Owns showcase display state (loading, error, collapse) and delegates loading and card mounting.
 * Not in this file: Showcase HTTP (src/showcase-loader.ts), card slot mounting (src/product-card-mounter.ts),
 *   or custom element registration (src/custom-element-adapter.ts).
 * Key dependencies: src/showcase-types.ts.
 * See also: src/custom-element-adapter.ts (host-facing mount API).
 */

import "@angular/compiler";
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostBinding,
  Input,
  OnChanges,
  OnDestroy,
  QueryList,
  SimpleChanges,
  ViewChildren,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { Subscription } from "rxjs";
import "./styles.css";
import type {
  Product,
  ProductShowcaseConfiguration,
  Showcase,
} from "./showcase-types";
import { fetchShowcaseById, ShowcaseRequestTracker } from "./showcase-loader";
import { ProductCardSlotMounter } from "./product-card-mounter";

@Component({
  standalone: true,
  selector: "angular-product-showcase",
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
export class ProductShowcaseElementComponent
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
  private readonly cardSlotMounter = new ProductCardSlotMounter();
  private readonly requestTracker = new ShowcaseRequestTracker();
  private hasViewInitialized = false;
  private isRenderScheduled = false;

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
    this.cardSlotMounter.cleanup();
    this.requestTracker.abort();
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
      this.requestTracker.reset();
      return;
    }

    if (this.requestTracker.hasLoaded(showcaseId, apiBaseUrl)) {
      return;
    }

    const abortController = this.requestTracker.begin(showcaseId, apiBaseUrl);
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

  private async renderCards(): Promise<void> {
    if (!this.productSlots) {
      this.cardSlotMounter.cleanup();
      return;
    }

    await this.cardSlotMounter.mountCards(
      this.productSlots
        .toArray()
        .map((slotElementRef) => slotElementRef.nativeElement),
      {
        products: this.fullProducts,
        productIds: this.productIds,
        apiBaseUrl: this.config.apiBaseUrl,
        actionLabel: this.config.actionLabel,
        hideQuantity: this.config.hideQuantity,
        variant: this.isModal ? "compact" : "default",
        mountProductCard: this.config.mountProductCard,
        onProductClick: this.config.onProductClick,
        onAddToCart: this.config.onAddToCart,
      },
    );
  }
}
