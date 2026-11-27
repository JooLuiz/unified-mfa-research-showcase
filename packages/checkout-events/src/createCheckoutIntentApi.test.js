/**
 * Verifies the shell's checkout intent listeners on an injected transport.
 * Role: Locks which coupon and place-order requests reach the shell handlers on every comparison branch.
 * Not in this file: The publish and subscribe round trip (src/createCheckoutEvents.test.js) or window names.
 * Key dependencies: node:test; src/createCheckoutEvents.js; test/support/createRecordingTransport.js.
 * See also: src/createCheckoutEvents.js; src/checkoutEventsContracts.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createCheckoutEvents } from "./createCheckoutEvents.js";
import { createRecordingTransport } from "../../../test/support/createRecordingTransport.js";

test("the coupon handler receives only valid coupons, and every place-order request reaches the shell", () => {
  const transport = createRecordingTransport();
  const checkoutEvents = createCheckoutEvents(transport);
  const received = { coupons: [], orders: 0 };
  checkoutEvents.ensureCheckoutIntentListeners({
    onCouponApplied: (coupon) => received.coupons.push(coupon),
    onPlaceOrderRequested: () => {
      received.orders += 1;
    },
  });

  checkoutEvents.publishCouponApplied({ code: " ten ", discountPercentage: 10 });
  transport.deliver("checkout", "coupon-applied", { code: "", discountPercentage: 10 });
  transport.deliver("checkout", "coupon-applied", { code: "ten" });
  checkoutEvents.publishPlaceOrderRequested();
  checkoutEvents.publishPlaceOrderRequested();

  assert.deepEqual(received, { coupons: [{ code: "ten", discountPercentage: 10 }], orders: 2 });
});

test("the listeners register once, and again after a reset", () => {
  const transport = createRecordingTransport();
  const checkoutEvents = createCheckoutEvents(transport);
  const coupons = [];
  const handlers = { onCouponApplied: (coupon) => coupons.push(coupon) };

  checkoutEvents.ensureCheckoutIntentListeners(handlers);
  checkoutEvents.ensureCheckoutIntentListeners(handlers);
  checkoutEvents.publishCouponApplied({ code: "ten", discountPercentage: 10 });
  assert.equal(coupons.length, 1);

  checkoutEvents.resetCheckoutIntentListeners();
  checkoutEvents.ensureCheckoutIntentListeners(handlers);
  checkoutEvents.publishCouponApplied({ code: "ten", discountPercentage: 10 });
  assert.equal(coupons.length, 3);
});

test("a handler left out is not called and does not throw", () => {
  const transport = createRecordingTransport();
  const checkoutEvents = createCheckoutEvents(transport);
  const coupons = [];
  checkoutEvents.ensureCheckoutIntentListeners({
    onCouponApplied: (coupon) => coupons.push(coupon),
  });

  checkoutEvents.publishPlaceOrderRequested();
  checkoutEvents.publishCouponApplied({ code: "ten", discountPercentage: 10 });
  assert.deepEqual(coupons, [{ code: "ten", discountPercentage: 10 }]);

  const orders = [];
  const orderOnlyCheckout = createCheckoutEvents(createRecordingTransport());
  orderOnlyCheckout.ensureCheckoutIntentListeners({
    onPlaceOrderRequested: () => orders.push("place"),
  });
  orderOnlyCheckout.publishCouponApplied({ code: "ten", discountPercentage: 10 });
  orderOnlyCheckout.publishPlaceOrderRequested();
  assert.deepEqual(orders, ["place"]);
});
