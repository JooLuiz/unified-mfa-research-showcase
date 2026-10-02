/**
 * Names checkout contracts shared by the checkout remote and the ecommerce shell.
 * Role: Holds coupon and place-order topic, event, and payload checks.
 * Not in this file: Order HTTP calls or window event names.
 * Key dependencies: None.
 * See also: src/createCheckoutEvents.js.
 */

const CHECKOUT_TOPIC = "checkout";
const COUPON_APPLIED_EVENT = "coupon-applied";
const PLACE_ORDER_REQUESTED_EVENT = "place-order-requested";

/**
 * Checks whether a value is a coupon code the shell can store.
 *
 * @param {unknown} value - Candidate coupon payload.
 * @returns {value is { code: string }} Whether the payload has a non-empty code.
 */
function isValidCouponApplied(value) {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = /** @type {{ code?: unknown }} */ (value);
  return typeof candidate.code === "string" && candidate.code.trim() !== "";
}

export {
  CHECKOUT_TOPIC,
  COUPON_APPLIED_EVENT,
  PLACE_ORDER_REQUESTED_EVENT,
  isValidCouponApplied,
};
