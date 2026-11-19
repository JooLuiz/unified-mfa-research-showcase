/**
 * Verifies the product-details template contains each shopper-visible state.
 * Role: Locks the loading, loaded, and not-found copy in the Angular template string.
 * Not in this file: Component behavior.
 * Key dependencies: node:test; src/product-details.template.ts.
 * See also: src/product-details.template.ts.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { PRODUCT_DETAILS_TEMPLATE } from "./product-details.template.ts";

test("the product details template includes loading, loaded, and not-found text", () => {
  assert.match(PRODUCT_DETAILS_TEMPLATE, /Loading product details\.\.\./);
  assert.match(PRODUCT_DETAILS_TEMPLATE, /\{\{ product\.name \}\}/);
  assert.match(PRODUCT_DETAILS_TEMPLATE, /Product not found\./);
});
