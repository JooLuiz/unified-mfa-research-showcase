/**
 * Filter and sort state for the product list page.
 * Role: Owns draft vs active filters, sort selection, active-tag removal, and the mobile filter panel.
 * Not in this file: Fetching (src/hooks/useProductListData.js) or grid window state (src/hooks/useResponsiveGrid.js).
 * Key dependencies: Pure helpers from src/productListFilters.js.
 * See also: src/ProductListView.js.
 */

import { useEffect, useMemo, useState } from "react";
import {
  normalizeFilters,
  normalizeFilterValue,
  getNumericValue,
} from "../productListFilters";

/**
 * Manages draft/active filter state and notifies the host of applied changes.
 *
 * @param {object} options - Hook options.
 * @param {object} options.initialFilters - Host-provided initial filters.
 * @param {string} [options.initialSort] - Host-provided initial sort key.
 * @param {(nextFilters: object) => void} [options.onFiltersChange] - Called after filters are applied, cleared, or a tag is removed.
 * @param {() => void} options.onFiltersApplied - Called whenever the result window should reset; must be a stable callback.
 * @returns {object} Filter state and handlers for the filter sidebar, toolbar, and tags.
 * @sideEffects Resets draft/active filters when initialFilters change.
 */
function useProductListFilters({
  initialFilters,
  initialSort,
  onFiltersChange,
  onFiltersApplied,
}) {
  const normalizedInitialFilters = useMemo(
    () => normalizeFilters(initialFilters),
    [initialFilters],
  );

  const [activeFilters, setActiveFilters] = useState(normalizedInitialFilters);
  const [activeSort, setActiveSort] = useState(initialSort || "");
  const [draftFilters, setDraftFilters] = useState(normalizedInitialFilters);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  useEffect(() => {
    setDraftFilters(normalizedInitialFilters);
    setActiveFilters(normalizedInitialFilters);
    onFiltersApplied();
  }, [normalizedInitialFilters, onFiltersApplied]);

  const notifyFiltersChange = (nextFilters) => {
    if (typeof onFiltersChange === "function") {
      onFiltersChange(nextFilters);
    }
  };

  const closeMobileFiltersOnSmallScreens = () => {
    if (typeof window !== "undefined" && window.innerWidth <= 768) {
      setIsMobileFiltersOpen(false);
    }
  };

  const updateSearchQuery = (nextValue) => {
    setDraftFilters((currentFilters) => ({
      ...currentFilters,
      searchQuery: nextValue,
    }));
  };

  const handleFilterInputChange = (fieldName, nextValue) => {
    const isEmptyValue = nextValue === "";
    const isNumericValue = /^\d+$/.test(nextValue);
    if (!isEmptyValue && !isNumericValue) {
      return;
    }
    setDraftFilters((currentFilters) => ({
      ...currentFilters,
      [fieldName]: nextValue,
    }));
  };

  const adjustFilterValue = (fieldName, delta) => {
    const currentValue = getNumericValue(draftFilters[fieldName]);
    const nextValue = Math.max(currentValue + delta, 0);
    setDraftFilters((currentFilters) => ({
      ...currentFilters,
      [fieldName]: String(nextValue),
    }));
  };

  const toggleCategorySelection = (categoryId) => {
    setDraftFilters((currentFilters) => {
      const hasCategoryId = currentFilters.categoryIds.includes(categoryId);
      return {
        ...currentFilters,
        categoryIds: hasCategoryId
          ? currentFilters.categoryIds.filter(
              (selectedCategoryId) => selectedCategoryId !== categoryId,
            )
          : [...currentFilters.categoryIds, categoryId],
      };
    });
  };

  const applyFilters = () => {
    const nextFilters = normalizeFilters({
      searchQuery: draftFilters.searchQuery.trim(),
      minPrice: normalizeFilterValue(draftFilters.minPrice),
      maxPrice: normalizeFilterValue(draftFilters.maxPrice),
      categoryIds: draftFilters.categoryIds,
    });
    setActiveFilters(nextFilters);
    onFiltersApplied();
    notifyFiltersChange(nextFilters);
    closeMobileFiltersOnSmallScreens();
  };

  const clearFilters = () => {
    const clearedFilters = normalizeFilters({});
    setDraftFilters(clearedFilters);
    setActiveFilters(clearedFilters);
    onFiltersApplied();
    notifyFiltersChange(clearedFilters);
    closeMobileFiltersOnSmallScreens();
  };

  const removeActiveFilter = (filterKey) => {
    const isCategoryRemoval = filterKey.startsWith("category:");
    const remainingCategoryIds = isCategoryRemoval
      ? activeFilters.categoryIds.filter(
          (selectedCategoryId) =>
            `category:${selectedCategoryId}` !== filterKey,
        )
      : activeFilters.categoryIds;

    const nextFilters = normalizeFilters({
      searchQuery: filterKey === "searchQuery" ? "" : activeFilters.searchQuery,
      minPrice: filterKey === "minPrice" ? "" : activeFilters.minPrice,
      maxPrice: filterKey === "maxPrice" ? "" : activeFilters.maxPrice,
      categoryIds: remainingCategoryIds,
    });

    setDraftFilters(nextFilters);
    setActiveFilters(nextFilters);
    onFiltersApplied();
    notifyFiltersChange(nextFilters);
  };

  const handleSortChange = (nextSortBy) => {
    setActiveSort(nextSortBy);
    onFiltersApplied();
  };

  const toggleMobileFilters = () => {
    setIsMobileFiltersOpen((currentState) => !currentState);
  };

  return {
    activeFilters,
    activeSort,
    draftFilters,
    isMobileFiltersOpen,
    updateSearchQuery,
    handleFilterInputChange,
    adjustFilterValue,
    toggleCategorySelection,
    applyFilters,
    clearFilters,
    removeActiveFilter,
    handleSortChange,
    toggleMobileFilters,
  };
}

export { useProductListFilters };
