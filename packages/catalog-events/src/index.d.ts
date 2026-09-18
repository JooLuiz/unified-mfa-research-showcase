export type CartAddRequest = {
  productId: string;
  quantity: number;
};

export type CartUpdateRequest = {
  productId: string;
  quantity: number;
};

export type CartRemoveRequest = {
  productId: string;
};

export type ProductOpenRequest = {
  productId: string;
};

export type PlpFilters = {
  searchQuery: string;
  minPrice: string;
  maxPrice: string;
  categoryIds: string[];
};

export type PromotionAppliedRequest = {
  filters: PlpFilters;
};

export type CatalogMeshClient = {
  publish(input: object): void;
  subscribe(
    topic: string,
    event: string,
    callback: (message: { payload: unknown }) => void,
  ): () => void;
};

export type CatalogIntentHandlers = {
  onProductOpenRequested?(payload: ProductOpenRequest): void;
  onCartItemAddRequested?(cartItem: CartAddRequest): void;
  onFiltersApplyRequested?(filters: PlpFilters): void;
  onPromotionApplied?(payload: PromotionAppliedRequest): void;
  onCartItemUpdateRequested?(cartItem: CartUpdateRequest): void;
  onCartItemRemoveRequested?(payload: CartRemoveRequest): void;
};

export type CatalogEvents = {
  publishProductOpenRequested(productId: string): void;
  publishCartItemAddRequested(cartItem: CartAddRequest): void;
  publishFiltersApplyRequested(filters: PlpFilters | object): void;
  publishPromotionApplied(promotion: { filters?: object }): void;
  publishCartItemUpdateRequested(cartItem: CartUpdateRequest): void;
  publishCartItemRemoveRequested(productId: string): void;
  ensureCatalogIntentListeners(handlers: CatalogIntentHandlers): void;
  resetCatalogIntentListeners(): void;
};

export declare const CART_TOPIC: "cart";
export declare const CART_ITEM_ADD_REQUESTED_EVENT: "item-add-requested";
export declare const CART_ITEM_UPDATE_REQUESTED_EVENT: "item-update-requested";
export declare const CART_ITEM_REMOVE_REQUESTED_EVENT: "item-remove-requested";
export declare const CATALOG_TOPIC: "catalog";
export declare const CATALOG_PRODUCT_OPEN_REQUESTED_EVENT: "product-open-requested";
export declare const CATALOG_FILTERS_APPLY_REQUESTED_EVENT: "filters-apply-requested";
export declare const CATALOG_PROMOTION_APPLIED_EVENT: "promotion-applied";

export function isValidProductOpenRequest(
  value: unknown,
): value is ProductOpenRequest;
export function isValidCartAddRequest(value: unknown): value is CartAddRequest;
export function isValidCartUpdateRequest(
  value: unknown,
): value is CartUpdateRequest;
export function isValidCartRemoveRequest(
  value: unknown,
): value is CartRemoveRequest;
export function isValidPlpFiltersPayload(value: unknown): boolean;
export function isValidPromotionAppliedRequest(
  value: unknown,
): value is { filters?: object };
export function createCartAddRequest(value: unknown): CartAddRequest | null;
export function createCartUpdateRequest(
  value: unknown,
): CartUpdateRequest | null;
export function createPlpFiltersSnapshot(filters: unknown): PlpFilters;

export function createCatalogEvents(input: {
  mesh: CatalogMeshClient;
}): CatalogEvents;
