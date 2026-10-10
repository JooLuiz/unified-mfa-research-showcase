export declare const STOCK_INSUFFICIENT_CODE: string;

export declare const STOCK_SESSION_RELEASE_HEADER_NAME: string;

export declare function getOrCreateGuestStockSessionId(): string;

export type StockReservationOutcome =
  | { ok: true; quantity: number; available: number }
  | { ok: false; code: string };

export type StockReservationInput = {
  apiBaseUrl: string;
  authToken?: string | null;
  guestSessionId?: string | null;
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
  subscribeToReconnect(listener: () => void): () => void;
};

export declare function createStockWatchClient(input: { apiBaseUrl: string }): StockWatchClient;
