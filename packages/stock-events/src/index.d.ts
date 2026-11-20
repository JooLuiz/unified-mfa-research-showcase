export declare const STOCK_INSUFFICIENT_CODE: string;

export declare const STOCK_SESSION_RELEASE_HEADER_NAME: string;

export declare function getOrCreateGuestStockSessionId(): string;

export type StockReservationOutcome =
  | { ok: true; quantity: number; available: number }
  | { ok: false; code: string };

export type StockCommandTransport = {
  request(message: {
    topic: string;
    event: string;
    payload?: { productId?: string; quantity?: number; sessionId?: string };
  }): Promise<StockReservationOutcome>;
};

export type StockReservationInput = {
  productId: string;
  quantity: number;
  sessionId?: string | null;
};

export declare function reserveStockQuantity(
  transport: StockCommandTransport,
  input: StockReservationInput,
): Promise<StockReservationOutcome>;

export declare function setStockQuantity(
  transport: StockCommandTransport,
  input: StockReservationInput,
): Promise<StockReservationOutcome>;

export type StockWatchClient = {
  watchProduct(productId: string, onAvailableChange: (available: number) => void): () => void;
  subscribeToReconnect(listener: () => void): () => void;
};

export type StockWatchTransport = {
  publish(message: { topic: string; event: string; payload?: object; scope?: string }): void;
  subscribe(
    topic: string,
    event: string,
    callback: (message: { payload?: { streamId?: string } }) => void,
  ): () => void;
};

export declare function createStockWatchClient(transport: StockWatchTransport): StockWatchClient;
