export type CartAddRequest = {
  productId: string;
  quantity: number;
};

export type ProductOpenRequest = {
  productId: string;
};

export type CatalogMeshClient = {
  publish(input: object): void;
  subscribe(
    topic: string,
    event: string,
    callback: (message: { payload: unknown }) => void,
  ): () => void;
};

export type CatalogEvents = {
  publishProductOpenRequested(productId: string): void;
  publishCartItemAddRequested(cartItem: CartAddRequest): void;
  ensureCatalogIntentListeners(handlers: {
    onProductOpenRequested(payload: ProductOpenRequest): void;
    onCartItemAddRequested(cartItem: CartAddRequest): void;
  }): void;
  resetCatalogIntentListeners(): void;
};

export declare const CART_TOPIC: "cart";
export declare const CART_ITEM_ADD_REQUESTED_EVENT: "item-add-requested";
export declare const CATALOG_TOPIC: "catalog";
export declare const CATALOG_PRODUCT_OPEN_REQUESTED_EVENT: "product-open-requested";

export function isValidProductOpenRequest(
  value: unknown,
): value is ProductOpenRequest;
export function isValidCartAddRequest(value: unknown): value is CartAddRequest;
export function createCartAddRequest(value: unknown): CartAddRequest | null;

export function createCatalogEvents(input: {
  mesh: CatalogMeshClient;
}): CatalogEvents;
