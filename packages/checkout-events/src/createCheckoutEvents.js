/**
 * Publishes and subscribes to shared checkout Event Mesh messages.
 * Role: Hides mesh transport details behind coupon and place-order operations for remotes and shells.
 * Not in this file: Mesh configuration, cart state ownership, order APIs, or UI rendering.
 * Key dependencies: An Event Mesh client supplied by the owning shell, or a recording transport in tests.
 * See also: src/checkoutEventContracts.js; src/createCheckoutEvents.test.js.
 */

import {
  CHECKOUT_COUPON_APPLIED_EVENT,
  CHECKOUT_PLACE_ORDER_REQUESTED_EVENT,
  CHECKOUT_TOPIC,
  createCouponAppliedRequest,
  isValidCouponAppliedRequest,
} from "./checkoutEventContracts.js";

/**
 * Creates a checkout-scoped local event adapter for checkout remotes and host shells.
 *
 * @param {{ publish: (input: object) => void, subscribe: (topic: string, event: string, callback: (message: object) => void) => () => void }} transport - Mesh client or recording transport. Both expose publish and subscribe.
 * @returns {object} Checkout event adapter with publish helpers and intent listeners.
 */
function createCheckoutEvents(transport) {
  let checkoutIntentListenersStarted = false;

  function publishLocalEvent(topic, event, payload = {}) {
    transport.publish({ topic, event, payload, scope: "local" });
  }

  /**
   * Publishes that a coupon was applied in a checkout remote.
   *
   * @param {{ code: string, discountPercentage: number }} coupon - Coupon code and discount.
   * @returns {void}
   * @sideEffects Publishes a local checkout.coupon-applied message when valid.
   */
  function publishCouponApplied(coupon) {
    const normalizedRequest = createCouponAppliedRequest(coupon);
    if (!normalizedRequest) {
      return;
    }

    publishLocalEvent(
      CHECKOUT_TOPIC,
      CHECKOUT_COUPON_APPLIED_EVENT,
      normalizedRequest,
    );
  }

  /**
   * Publishes a request for the host shell to place the current order.
   *
   * @returns {void}
   * @sideEffects Publishes a local checkout.place-order-requested message with no payload.
   */
  function publishPlaceOrderRequested() {
    transport.publish({
      topic: CHECKOUT_TOPIC,
      event: CHECKOUT_PLACE_ORDER_REQUESTED_EVENT,
      scope: "local",
    });
  }

  /**
   * Subscribes to valid coupon-applied messages until the returned function runs.
   *
   * @param {(payload: { code: string, discountPercentage: number }) => void} listener - Called with each valid coupon.
   * @returns {() => void} Removes the subscription.
   * @sideEffects Registers a local checkout subscription. Invalid payloads are ignored.
   */
  function subscribeToCouponApplied(listener) {
    return transport.subscribe(CHECKOUT_TOPIC, CHECKOUT_COUPON_APPLIED_EVENT, (message) => {
      if (!isValidCouponAppliedRequest(message.payload)) {
        return;
      }
      listener(message.payload);
    });
  }

  /**
   * Subscribes to place-order requests until the returned function runs.
   *
   * @param {() => void} listener - Called for each place-order request.
   * @returns {() => void} Removes the subscription.
   * @sideEffects Registers a local checkout subscription.
   */
  function subscribeToPlaceOrderRequests(listener) {
    return transport.subscribe(CHECKOUT_TOPIC, CHECKOUT_PLACE_ORDER_REQUESTED_EVENT, () => {
      listener();
    });
  }

  /**
   * Registers persistent checkout intent handlers after a mesh configuration change.
   *
   * @param {{
   *   onCouponApplied?: (payload: { code: string, discountPercentage: number }) => void,
   *   onPlaceOrderRequested?: () => void,
   * }} handlers - Host orchestration handlers.
   * @returns {void}
   * @sideEffects Registers local mesh subscriptions for provided handlers.
   */
  function ensureCheckoutIntentListeners(handlers) {
    if (checkoutIntentListenersStarted) {
      return;
    }

    checkoutIntentListenersStarted = true;

    if (typeof handlers.onCouponApplied === "function") {
      subscribeToCouponApplied(handlers.onCouponApplied);
    }

    if (typeof handlers.onPlaceOrderRequested === "function") {
      subscribeToPlaceOrderRequests(handlers.onPlaceOrderRequested);
    }
  }

  /**
   * Marks checkout intent subscriptions for re-registration after mesh.close() clears them.
   *
   * @returns {void}
   */
  function resetCheckoutIntentListeners() {
    checkoutIntentListenersStarted = false;
  }

  return {
    publishCouponApplied,
    publishPlaceOrderRequested,
    subscribeToCouponApplied,
    subscribeToPlaceOrderRequests,
    ensureCheckoutIntentListeners,
    resetCheckoutIntentListeners,
  };
}

export { createCheckoutEvents };
