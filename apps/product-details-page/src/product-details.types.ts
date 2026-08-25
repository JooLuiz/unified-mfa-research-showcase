/**
 * Shared types for the product details MFE.
 * Role: Single source for the product, cart payload, similar-products mount, and host-facing props contracts.
 * Not in this file: Runtime logic.
 * Key dependencies: None.
 * See also: src/product-details.component.ts, src/product-details-adapter.ts.
 */

export type Product = {
  id: string;
  name: string;
  price: number;
  image: string;
  similarProducts?: string[];
};

export type AddToCartPayload = {
  productId: string;
  quantity: number;
};

export type MountSimilarProductsProps = {
  title: string;
  productIds: string[];
  apiBaseUrl: string;
};

export type MountSimilarProducts = (
  containerElement: HTMLElement,
  props: MountSimilarProductsProps,
) => (() => void) | void;

export type ProductDetailsProps = {
  product?: Product;
  apiBaseUrl?: string;
  onAddToCart?: (payload: AddToCartPayload) => void;
  mountSimilarProducts: MountSimilarProducts;
};
