/**
 * Responsive grid sizing for the product list page.
 * Role: Owns items-per-row estimation from viewport width and the visible-count window.
 * Not in this file: Product data or filter state.
 * Key dependencies: Window resize events.
 * See also: src/ProductListView.js.
 */

import { useCallback, useEffect, useRef, useState } from "react";

const MINIMUM_CARD_WIDTH = 170;
const CARD_GAP = 12;
const FILTERS_COLUMN_WIDTH = 220;
const PAGE_PADDING_ALLOWANCE = 96;

function calculateItemsPerRow() {
  if (typeof window === "undefined") {
    return 4;
  }
  const estimatedGridWidth = Math.max(
    window.innerWidth - FILTERS_COLUMN_WIDTH - PAGE_PADDING_ALLOWANCE,
    MINIMUM_CARD_WIDTH,
  );
  const estimatedCardsPerRow = Math.floor(
    (estimatedGridWidth + CARD_GAP) / (MINIMUM_CARD_WIDTH + CARD_GAP),
  );
  return Math.max(estimatedCardsPerRow, 1);
}

function getInitialVisibleCount(itemsPerRow) {
  return Math.max(itemsPerRow * 2, 2);
}

/**
 * Tracks the responsive grid window: how many product cards are visible.
 *
 * @returns {{ visibleCount: number, resetVisibleCount: () => void, loadMore: () => void }} Visible count and its controls.
 * @sideEffects Subscribes to window resize events for the component lifetime.
 */
function useResponsiveGrid() {
  const [itemsPerRow, setItemsPerRow] = useState(() => calculateItemsPerRow());
  const [visibleCount, setVisibleCount] = useState(() =>
    getInitialVisibleCount(calculateItemsPerRow()),
  );
  const itemsPerRowRef = useRef(itemsPerRow);

  useEffect(() => {
    itemsPerRowRef.current = itemsPerRow;
  }, [itemsPerRow]);

  useEffect(() => {
    function handleWindowResize() {
      const nextItemsPerRow = calculateItemsPerRow();
      setItemsPerRow((currentItemsPerRow) => {
        if (currentItemsPerRow === nextItemsPerRow) {
          return currentItemsPerRow;
        }
        setVisibleCount((currentVisibleCount) =>
          Math.max(
            currentVisibleCount,
            getInitialVisibleCount(nextItemsPerRow),
          ),
        );
        return nextItemsPerRow;
      });
    }

    if (typeof window === "undefined") {
      return undefined;
    }
    window.addEventListener("resize", handleWindowResize);
    return () => {
      window.removeEventListener("resize", handleWindowResize);
    };
  }, []);

  const resetVisibleCount = useCallback(() => {
    setVisibleCount(getInitialVisibleCount(itemsPerRowRef.current));
  }, []);

  const loadMore = useCallback(() => {
    setVisibleCount(
      (currentVisibleCount) => currentVisibleCount + itemsPerRowRef.current,
    );
  }, []);

  return { visibleCount, resetVisibleCount, loadMore };
}

export { useResponsiveGrid };
