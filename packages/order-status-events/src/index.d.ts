export declare function formatOrderStatus(status: string | null | undefined): string;

export declare function startCustomerOrderStatusStream(input: {
  apiBaseUrl: string;
  authToken: string;
}): Promise<void>;

export declare function stopCustomerOrderStatusStream(): void;

export declare function subscribeToOrderStatusChanged(
  listener: (event: { orderId: string; status: string }) => void,
): () => void;

export declare function requestOrderCancellation(input: {
  apiBaseUrl: string;
  authToken: string;
  orderId: string;
}): Promise<{ ok: true; order: object } | { ok: false; code: string }>;

export declare function startAdminOrderStatusStream(input: {
  apiBaseUrl: string;
  authToken: string;
}): Promise<void>;

export declare function stopAdminOrderStatusStream(): void;

export declare function subscribeToAdminOrderStatusChanged(
  listener: (event: { orderId: string; status: string }) => void,
): () => void;

export declare function requestAdminOrderStatusChange(input: {
  apiBaseUrl: string;
  authToken: string;
  orderId: string;
  status: string;
}): Promise<{ ok: true; order: object } | { ok: false; code: string }>;
