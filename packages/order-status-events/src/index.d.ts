export declare function formatOrderStatus(status: string | null | undefined): string;

type OrderStatusTransport = {
  subscribe(
    topic: string,
    event: string,
    callback: (message: { payload?: { orderId?: string; status?: string } }) => void,
  ): () => void;
  request(message: {
    topic: string;
    event: string;
    payload?: { orderId?: string; status?: string; actor?: string };
  }): Promise<{ ok: true; order: object } | { ok: false; code: string }>;
};

export declare function startCustomerOrderStatusStream(transport: OrderStatusTransport): void;

export declare function stopCustomerOrderStatusStream(): void;

export declare function subscribeToOrderStatusChanged(
  listener: (event: { orderId: string; status: string }) => void,
): () => void;

export declare function requestOrderCancellation(
  transport: OrderStatusTransport,
  input: { orderId: string },
): Promise<{ ok: true; order: object } | { ok: false; code: string }>;

export declare function startAdminOrderStatusStream(transport: OrderStatusTransport): void;

export declare function stopAdminOrderStatusStream(): void;

export declare function subscribeToAdminOrderStatusChanged(
  listener: (event: { orderId: string; status: string }) => void,
): () => void;

export declare function requestAdminOrderStatusChange(
  transport: OrderStatusTransport,
  input: { orderId: string; status: string },
): Promise<{ ok: true; order: object } | { ok: false; code: string }>;
