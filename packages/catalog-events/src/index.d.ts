export const CART_TOPIC: string;
export const CART_ITEM_ADD_REQUESTED_EVENT: string;
export const CART_CHANGED_EVENT: string;
export const CATALOG_TOPIC: string;
export const PRODUCT_OPEN_REQUESTED_EVENT: string;

export interface CartAddRequest {
  productId: string;
  quantity?: number;
}

export function isValidCartAddRequest(value: unknown): value is CartAddRequest;

export interface CatalogTransport {
  publish(message: { topic: string; event: string; payload?: object; scope: string }): void;
  subscribe(
    topic: string,
    event: string,
    callback: (message: { payload?: unknown }) => void,
  ): () => void;
}

export interface CatalogEvents {
  publishCartItemAddRequested(payload: CartAddRequest): void;
  subscribeToCartItemAddRequests(listener: (payload: CartAddRequest) => void): () => void;
  publishCartChanged(): void;
  subscribeToCartChanges(listener: () => void): () => void;
  publishProductOpenRequested(payload: { productId: string }): void;
}

export function createCatalogEvents(transport: CatalogTransport): CatalogEvents;
