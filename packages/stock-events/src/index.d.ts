export declare const STOCK_INSUFFICIENT_CODE: string;

export declare const GUEST_STOCK_SESSION_RELEASE_FIELD: string;

export declare function getOrCreateGuestStockSessionId(): string;

export type StockMeshClient = {
  publish(input: object): void;
  subscribe(topic: string, event: string, callback: (message: object) => void): () => void;
};

export type StockReservationOutcome =
  | { ok: true; quantity: number; available: number }
  | { ok: false; code: string };

export type StockReservationInput = {
  mesh: StockMeshClient;
  sessionId?: string | null;
  productId: string;
  quantity: number;
};

export declare function reserveStockQuantity(
  input: StockReservationInput,
): Promise<StockReservationOutcome>;

export declare function setStockQuantity(
  input: StockReservationInput,
): Promise<StockReservationOutcome>;

export type StockWatchClient = {
  watchProduct(productId: string, onAvailableChange: (available: number) => void): () => void;
};

export declare function createStockWatchClient(input: { mesh: StockMeshClient }): StockWatchClient;
