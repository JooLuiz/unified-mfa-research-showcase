/**
 * Verifies checkout coupon and place-order messages on an injected transport.
 * Role: Locks topic, event, payload, scope, and the coupon payload guard.
 * Not in this file: Order HTTP or window event names.
 * Key dependencies: node:test; src/createCheckoutEvents.js; test/support/createRecordingTransport.js.
 * See also: src/createCheckoutEvents.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createCheckoutEvents } from "./createCheckoutEvents.js";
import { createRecordingTransport } from "../../../test/support/createRecordingTransport.js";

test("publishCouponApplied emits a local checkout message and drops a blank code", () => {
  const transport = createRecordingTransport();
  const checkoutEvents = createCheckoutEvents(transport);

  checkoutEvents.publishCouponApplied({ code: "SAVE10" });
  checkoutEvents.publishCouponApplied({ code: "  " });
  checkoutEvents.publishCouponApplied(null);

  assert.deepEqual(transport.published, [
    {
      topic: "checkout",
      event: "coupon-applied",
      payload: { code: "SAVE10" },
      scope: "local",
    },
  ]);
});

test("subscribeToCouponApplied ignores an invalid payload and stops after unsubscribe", () => {
  const transport = createRecordingTransport();
  const checkoutEvents = createCheckoutEvents(transport);
  const received = [];
  const unsubscribe = checkoutEvents.subscribeToCouponApplied((payload) => {
    received.push(payload);
  });

  transport.publish({
    topic: "checkout",
    event: "coupon-applied",
    payload: { code: "" },
    scope: "local",
  });
  checkoutEvents.publishCouponApplied({ code: "WELCOME" });
  unsubscribe();
  checkoutEvents.publishCouponApplied({ code: "LATER" });

  assert.deepEqual(received, [{ code: "WELCOME" }]);
});

test("publishPlaceOrderRequested emits a local checkout message until unsubscribe", () => {
  const transport = createRecordingTransport();
  const checkoutEvents = createCheckoutEvents(transport);
  const deliveries = [];
  const unsubscribe = checkoutEvents.subscribeToPlaceOrderRequests(() => {
    deliveries.push("place");
  });

  checkoutEvents.publishPlaceOrderRequested();
  unsubscribe();
  checkoutEvents.publishPlaceOrderRequested();

  assert.deepEqual(transport.published, [
    { topic: "checkout", event: "place-order-requested", scope: "local" },
    { topic: "checkout", event: "place-order-requested", scope: "local" },
  ]);
  assert.deepEqual(deliveries, ["place"]);
});
