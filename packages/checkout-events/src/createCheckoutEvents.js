/**
 * Publishes and subscribes to checkout contracts.
 * Role: Exposes coupon and place-order operations over an injected transport.
 * Not in this file: Order placement HTTP or the browser event-name map.
 * Key dependencies: src/checkoutEventsContracts.js.
 * See also: src/index.js.
 */

import {
  CHECKOUT_TOPIC,
  COUPON_APPLIED_EVENT,
  PLACE_ORDER_REQUESTED_EVENT,
  isValidCouponApplied,
} from "./checkoutEventsContracts.js";

/**
 * Creates checkout event operations bound to a transport.
 *
 * @param {{ publish: (message: { topic: string, event: string, payload?: object, scope: string }) => void, subscribe: (topic: string, event: string, callback: (message: { payload?: unknown }) => void) => () => void }} transport - Branch transport.
 * @returns {{ publishCouponApplied: (payload: { code: string }) => void, subscribeToCouponApplied: (listener: (payload: { code: string }) => void) => () => void, publishPlaceOrderRequested: () => void, subscribeToPlaceOrderRequests: (listener: () => void) => () => void }} Checkout event operations.
 */
function createCheckoutEvents({ publish, subscribe }) {
  function publishCouponApplied(payload) {
    if (!isValidCouponApplied(payload)) {
      return;
    }
    publish({
      topic: CHECKOUT_TOPIC,
      event: COUPON_APPLIED_EVENT,
      payload,
      scope: "local",
    });
  }

  function subscribeToCouponApplied(listener) {
    return subscribe(CHECKOUT_TOPIC, COUPON_APPLIED_EVENT, (message) => {
      if (isValidCouponApplied(message.payload)) {
        listener(message.payload);
      }
    });
  }

  function publishPlaceOrderRequested() {
    publish({
      topic: CHECKOUT_TOPIC,
      event: PLACE_ORDER_REQUESTED_EVENT,
      scope: "local",
    });
  }

  function subscribeToPlaceOrderRequests(listener) {
    return subscribe(CHECKOUT_TOPIC, PLACE_ORDER_REQUESTED_EVENT, () => {
      listener();
    });
  }

  return {
    publishCouponApplied,
    subscribeToCouponApplied,
    publishPlaceOrderRequested,
    subscribeToPlaceOrderRequests,
  };
}

export { createCheckoutEvents };
