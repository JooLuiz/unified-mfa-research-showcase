/**
 * Verifies product-list row sizing without mounting the grid hook.
 * Role: Locks the no-window default, the first visible count, and a wide viewport.
 * Not in this file: Resize subscriptions or product data.
 * Key dependencies: node:test; src/hooks/useResponsiveGrid.js.
 * See also: src/hooks/useResponsiveGrid.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { calculateItemsPerRow, getInitialVisibleCount } from "./useResponsiveGrid.js";

test("calculateItemsPerRow returns 4 when no window is available", () => {
  assert.equal(calculateItemsPerRow(), 4);
});

test("getInitialVisibleCount shows two rows and at least two cards", () => {
  assert.equal(getInitialVisibleCount(5), 10);
  assert.equal(getInitialVisibleCount(0), 2);
});

test("calculateItemsPerRow returns more than one card on a wide viewport", () => {
  globalThis.window = { innerWidth: 1280 };
  try {
    assert.ok(calculateItemsPerRow() > 1);
  } finally {
    delete globalThis.window;
  }
});
