/**
 * Verifies product-list row sizing without mounting the grid hook.
 * Role: Locks the no-window default, the first visible count, and a wide viewport.
 * Not in this file: Resize subscriptions or product data.
 * Key dependencies: node:test; src/hooks/useResponsiveGrid.js.
 * See also: src/hooks/useResponsiveGrid.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { installDomDocument } from "../../../../test/support/installDomDocument.js";
import { calculateItemsPerRow, getInitialVisibleCount, useResponsiveGrid } from "./useResponsiveGrid.js";

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

/**
 * Installs a window that can resize and report a width.
 *
 * @param {number} innerWidth - Viewport width in pixels.
 * @returns {void}
 */
function installResizableWindow(innerWidth) {
  const listeners = new Set();
  globalThis.window = {
    innerWidth,
    addEventListener(_type, listener) {
      listeners.add(listener);
    },
    removeEventListener(_type, listener) {
      listeners.delete(listener);
    },
    dispatchEvent(event) {
      for (const listener of listeners) {
        listener(event);
      }
      return true;
    },
  };
}

test("useResponsiveGrid grows by one row, resets, and expands when the viewport widens", async () => {
  installResizableWindow(400);
  const { root } = installDomDocument();
  const reactRoot = createRoot(root);
  const seenCounts = [];

  function GridProbe() {
    const grid = useResponsiveGrid();
    useEffect(() => {
      seenCounts.push(grid.visibleCount);
    });
    root.loadMore = grid.loadMore;
    root.resetVisibleCount = grid.resetVisibleCount;
    return null;
  }

  try {
    const narrowCount = getInitialVisibleCount(calculateItemsPerRow());
    assert.equal(narrowCount, 2);

    await act(async () => {
      reactRoot.render(createElement(GridProbe));
    });
    assert.equal(seenCounts.at(-1), 2);

    await act(async () => {
      root.loadMore();
    });
    assert.equal(seenCounts.at(-1), 3);

    await act(async () => {
      root.resetVisibleCount();
    });
    assert.equal(seenCounts.at(-1), 2);

    window.innerWidth = 1280;
    await act(async () => {
      window.dispatchEvent(new Event("resize"));
    });
    assert.equal(seenCounts.at(-1), getInitialVisibleCount(calculateItemsPerRow()));
    assert.ok(seenCounts.at(-1) > 2);
  } finally {
    await act(async () => {
      reactRoot.unmount();
    });
    delete globalThis.window;
  }
});
