/**
 * Defines shared local Event Mesh contracts for checkout intents.
 * Role: Centralizes topic/event names and payload validators for coupon and place-order messages.
 * Not in this file: Mesh publishing, cart ownership, order persistence, or UI rendering.
 * Key dependencies: None.
 * See also: src/createCheckoutEvents.js; MESH_IMPLEMENTATIONS/remote-intents.md.
 */

const CHECKOUT_TOPIC = "checkout";
const CHECKOUT_COUPON_APPLIED_EVENT = "coupon-applied";
const CHECKOUT_PLACE_ORDER_REQUESTED_EVENT = "place-order-requested";

/**
 * @typedef {{ code: string, discountPercentage: number }} CouponAppliedRequest
 */

function isRecord(value) {
  return Boolean(value) && typeof value === "object";
}

/**
 * Checks whether a value can request applying a coupon.
 *
 * @param {unknown} value - Candidate coupon payload.
 * @returns {value is CouponAppliedRequest} Whether the payload has a code and finite discount.
 */
function isValidCouponAppliedRequest(value) {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.code === "string" &&
    value.code.trim() !== "" &&
    Number.isFinite(value.discountPercentage)
  );
}

/**
 * Creates a safe coupon-applied payload for mesh delivery.
 *
 * @param {unknown} value - Candidate coupon request.
 * @returns {CouponAppliedRequest | null} Normalized payload, or null when invalid.
 */
function createCouponAppliedRequest(value) {
  if (!isValidCouponAppliedRequest(value)) {
    return null;
  }

  return {
    code: value.code.trim(),
    discountPercentage: Number(value.discountPercentage),
  };
}

export {
  CHECKOUT_COUPON_APPLIED_EVENT,
  CHECKOUT_PLACE_ORDER_REQUESTED_EVENT,
  CHECKOUT_TOPIC,
  createCouponAppliedRequest,
  isValidCouponAppliedRequest,
};
