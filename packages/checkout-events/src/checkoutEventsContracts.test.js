/**
 * Verifies the checkout coupon validator and normaliser.
 * Role: Locks which coupon payloads the shell accepts and how they are cleaned, on every comparison branch.
 * Not in this file: Publishing or listening (src/createCheckoutIntentApi.test.js).
 * Key dependencies: node:test; src/checkoutEventsContracts.js.
 * See also: src/checkoutEventsContracts.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  createCouponAppliedRequest,
  isValidCouponAppliedRequest,
} from "./checkoutEventsContracts.js";

test("a coupon needs a non-blank code and a finite discount", () => {
  assert.equal(isValidCouponAppliedRequest({ code: "ten", discountPercentage: 10 }), true);
  assert.equal(isValidCouponAppliedRequest({ code: "ten", discountPercentage: 0 }), true);

  [
    null,
    undefined,
    "ten",
    {},
    { code: "", discountPercentage: 10 },
    { code: "   ", discountPercentage: 10 },
    { code: 10, discountPercentage: 10 },
    { code: "ten" },
    { code: "ten", discountPercentage: "10" },
    { code: "ten", discountPercentage: Number.NaN },
    { code: "ten", discountPercentage: Number.POSITIVE_INFINITY },
  ].forEach((candidate) => {
    assert.equal(isValidCouponAppliedRequest(candidate), false, String(JSON.stringify(candidate)));
  });
});

test("a valid coupon is trimmed and keeps only its code and discount", () => {
  assert.deepEqual(
    createCouponAppliedRequest({ code: "  fifty ", discountPercentage: 50, extra: true }),
    { code: "fifty", discountPercentage: 50 },
  );
  assert.equal(createCouponAppliedRequest({ code: " ", discountPercentage: 50 }), null);
  assert.equal(createCouponAppliedRequest(null), null);
});
