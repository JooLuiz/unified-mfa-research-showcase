/**
 * Verifies cart line and coupon copies used before a save or login merge.
 * Role: Locks which lines and coupons are kept and how guest quantities combine.
 * Not in this file: HTTP saves, shell state, or cross-tab messages.
 * Key dependencies: node:test; src/utils/cartSnapshot.js.
 * See also: src/utils/cartSnapshot.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { cloneAppliedCoupon, cloneCartItems, mergeCartItems } from "./cartSnapshot.js";

test("cloneCartItems drops a missing product, a quantity below 1, and floors 1.9", () => {
  assert.deepEqual(cloneCartItems(null), []);
  assert.deepEqual(
    cloneCartItems([
      { quantity: 2 },
      { productId: "sku-lamp", quantity: 0 },
      { productId: "sku-chair", quantity: 1.9 },
    ]),
    [{ productId: "sku-chair", quantity: 1 }],
  );
});

test("cloneAppliedCoupon keeps a non-negative discount and drops an invalid coupon", () => {
  assert.equal(cloneAppliedCoupon(null), null);
  assert.equal(cloneAppliedCoupon({ discountPercentage: 10 }), null);
  assert.equal(cloneAppliedCoupon({ code: "SAVE10", discountPercentage: -5 }), null);
  assert.deepEqual(cloneAppliedCoupon({ code: "SAVE10", discountPercentage: 10 }), {
    code: "SAVE10",
    discountPercentage: 10,
  });
});

test("mergeCartItems adds a guest quantity onto the saved line for the same product", () => {
  const savedItems = [{ productId: "sku-lamp", quantity: 2 }];

  assert.deepEqual(
    mergeCartItems(savedItems, [{ productId: "sku-lamp", quantity: 1 }]),
    [{ productId: "sku-lamp", quantity: 3 }],
  );
  assert.deepEqual(mergeCartItems(savedItems, []), savedItems);
});
