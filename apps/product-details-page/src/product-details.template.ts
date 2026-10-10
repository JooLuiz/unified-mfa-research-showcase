/**
 * Inline template for the product details Angular component.
 * Role: Presentation markup only — loading, loaded (with availability/out-of-stock), and
 *   not-found states.
 * Not in this file: Component behavior or availability watching (src/product-details.component.ts).
 * Key dependencies: None.
 * See also: src/product-details.component.ts.
 */

export const PRODUCT_DETAILS_TEMPLATE = `
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
          <p *ngIf="availableCount !== null" class="pdp-availability" [class.out-of-stock]="isOutOfStock">
            {{ isOutOfStock ? "Out of stock" : availableCount + " available" }}
          </p>
          <ng-container *ngIf="!isOutOfStock">
            <div class="pdp-quantity-shell">
              <button class="pdp-quantity-control-button" type="button" (click)="decreaseQuantity()">-</button>
              <input
                class="pdp-quantity-value-input"
                type="number"
                min="1"
                [attr.max]="availableCount"
                [value]="quantityValue"
                (change)="handleQuantityChange($event)"
              />
            <button
              class="pdp-quantity-control-button"
              type="button"
              [disabled]="isAtMaxQuantity"
              (click)="increaseQuantity()"
            >+</button>
            </div>
            <button class="pdp-add-to-cart-button" type="button" (click)="handleAddToCart()">
              Add to Cart
            </button>
          </ng-container>
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
`;
