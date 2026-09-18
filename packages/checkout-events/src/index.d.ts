export type CouponAppliedRequest = {
  code: string;
  discountPercentage: number;
};

export type CheckoutMeshClient = {
  publish(input: object): void;
  subscribe(
    topic: string,
    event: string,
    callback: (message: { payload: unknown }) => void,
  ): () => void;
};

export type CheckoutIntentHandlers = {
  onCouponApplied?(payload: CouponAppliedRequest): void;
  onPlaceOrderRequested?(): void;
};

export type CheckoutEvents = {
  publishCouponApplied(coupon: CouponAppliedRequest): void;
  publishPlaceOrderRequested(): void;
  ensureCheckoutIntentListeners(handlers: CheckoutIntentHandlers): void;
  resetCheckoutIntentListeners(): void;
};

export declare const CHECKOUT_TOPIC: "checkout";
export declare const CHECKOUT_COUPON_APPLIED_EVENT: "coupon-applied";
export declare const CHECKOUT_PLACE_ORDER_REQUESTED_EVENT: "place-order-requested";

export function isValidCouponAppliedRequest(
  value: unknown,
): value is CouponAppliedRequest;
export function createCouponAppliedRequest(
  value: unknown,
): CouponAppliedRequest | null;

export function createCheckoutEvents(input: {
  mesh: CheckoutMeshClient;
}): CheckoutEvents;
