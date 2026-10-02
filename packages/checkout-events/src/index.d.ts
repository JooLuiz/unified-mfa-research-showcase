export const CHECKOUT_TOPIC: string;
export const COUPON_APPLIED_EVENT: string;
export const PLACE_ORDER_REQUESTED_EVENT: string;

export interface CouponAppliedPayload {
  code: string;
}

export function isValidCouponApplied(value: unknown): value is CouponAppliedPayload;

export interface CheckoutTransport {
  publish(message: { topic: string; event: string; payload?: object; scope: string }): void;
  subscribe(
    topic: string,
    event: string,
    callback: (message: { payload?: unknown }) => void,
  ): () => void;
}

export interface CheckoutEvents {
  publishCouponApplied(payload: CouponAppliedPayload): void;
  subscribeToCouponApplied(listener: (payload: CouponAppliedPayload) => void): () => void;
  publishPlaceOrderRequested(): void;
  subscribeToPlaceOrderRequests(listener: () => void): () => void;
}

export function createCheckoutEvents(transport: CheckoutTransport): CheckoutEvents;
