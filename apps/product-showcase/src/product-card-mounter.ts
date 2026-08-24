/**
 * Product card slot mounting for the product showcase element.
 * Role: Owns resolving the product card mount function and mounting/cleaning up cards in DOM slots.
 * Not in this file: Showcase data loading (src/showcase-loader.ts) or component state.
 * Key dependencies: product_card/ProductCard remote (dynamically imported when no mount function is provided).
 * See also: src/product-showcase-element.ts.
 */

import type {
  AddToCartPayload,
  MountProductCard,
  MountProductCardProps,
  Product,
} from "./showcase-types";

/**
 * Inputs for mounting one set of card slots.
 */
export type CardSlotMountOptions = {
  products: Product[];
  productIds: string[];
  apiBaseUrl?: string;
  actionLabel?: string;
  hideQuantity?: boolean;
  variant?: "default" | "compact";
  mountProductCard?: MountProductCard;
  onProductClick?: (productId: string) => void;
  onAddToCart?: (payload: AddToCartPayload) => void;
};

async function resolveMountProductCard(
  explicitMount?: MountProductCard,
): Promise<MountProductCard | null> {
  if (typeof explicitMount === "function") {
    return explicitMount;
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

/**
 * Mounts product cards into DOM slots and tracks their cleanup functions.
 */
export class ProductCardSlotMounter {
  private cardCleanupFunctions: Array<() => void> = [];

  /**
   * Replaces any mounted cards with cards for the given options.
   *
   * @param slotElements - DOM slot elements, one per product.
   * @param options - Card content and behavior options.
   * @sideEffects Mounts card MFEs into the given slots after cleaning up previous mounts.
   */
  async mountCards(
    slotElements: HTMLElement[],
    options: CardSlotMountOptions,
  ): Promise<void> {
    this.cleanup();

    const mountProductCard = await resolveMountProductCard(options.mountProductCard);
    if (typeof mountProductCard !== "function") {
      return;
    }

    const hasFullProducts = options.products.length > 0;
    if (!hasFullProducts && !options.apiBaseUrl) {
      return;
    }

    slotElements.forEach((slotElement, index) => {
      const cardProps: MountProductCardProps = {
        actionLabel: options.actionLabel,
        hideQuantity: options.hideQuantity,
        variant: options.variant,
        onProductClick: options.onProductClick,
        onAddToCart: options.onAddToCart,
      };

      if (hasFullProducts) {
        const product = options.products[index];
        if (!product) {
          return;
        }
        cardProps.product = product;
      } else {
        const productId = options.productIds[index];
        if (!productId) {
          return;
        }
        cardProps.productId = productId;
        cardProps.apiBaseUrl = options.apiBaseUrl;
      }

      const cleanupValue = mountProductCard(slotElement, cardProps);

      if (typeof cleanupValue === "function") {
        this.cardCleanupFunctions.push(cleanupValue);
      }
    });
  }

  /**
   * Runs all tracked card cleanup functions.
   */
  cleanup(): void {
    this.cardCleanupFunctions.forEach((cleanupFunction) => {
      cleanupFunction();
    });
    this.cardCleanupFunctions = [];
  }
}
