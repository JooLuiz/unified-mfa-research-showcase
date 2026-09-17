/**
 * Persists and hydrates ecommerce PLP filter state.
 * Role: Owns localStorage cache for PLP filters and publishes catalog.filters-changed on write.
 * Not in this file: Product list UI, mesh configuration, or route rendering.
 * Key dependencies: src/events/localMeshEventBus.js; src/utils/constants.js FILTER_STORAGE_KEY.
 * See also: src/pages/catalogPages.js; src/pages/promotionsPage.js; MESH_IMPLEMENTATIONS/storage-coordination.md.
 */

import { FILTER_STORAGE_KEY } from "./constants";
import { publishPlpFiltersChanged } from "../events/localMeshEventBus";

/**
 * Hydrates appState.plpFilters from localStorage.
 *
 * @param {{ plpFilters: object }} appState - Shell state holding PLP filters.
 * @returns {void}
 * @sideEffects May mutate appState.plpFilters from the localStorage cache.
 * @note Call publishPlpFiltersChanged after mesh is configured so bootstrap hydrate syncs subscribers.
 */
function readStoredPLPFilters(appState) {
  try {
    const storedValue = localStorage.getItem(FILTER_STORAGE_KEY);
    if (!storedValue) {
      return;
    }
    const parsedValue = JSON.parse(storedValue);
    const storedCategoryIds = Array.isArray(parsedValue.categoryIds)
      ? parsedValue.categoryIds.filter(
          (categoryId) => typeof categoryId === "string",
        )
      : [];
    appState.plpFilters = {
      searchQuery: parsedValue.searchQuery || "",
      minPrice: parsedValue.minPrice || "",
      maxPrice: parsedValue.maxPrice || "",
      categoryIds: storedCategoryIds,
    };
  } catch (error) {
    console.warn("Unable to parse stored PLP filters", error);
  }
}

/**
 * Writes PLP filters to localStorage and publishes a local mesh snapshot.
 *
 * @param {{ plpFilters: object }} appState - Shell state holding PLP filters.
 * @returns {void}
 * @sideEffects Writes localStorage and publishes catalog.filters-changed.
 */
function storePLPFilters(appState) {
  localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(appState.plpFilters));
  publishPlpFiltersChanged(appState.plpFilters);
}

/**
 * Normalizes incoming PLP filter values into the shell's canonical shape.
 *
 * @param {object} nextFilters - Candidate filter values from UI or promotions.
 * @returns {{ searchQuery: string, minPrice: string, maxPrice: string, categoryIds: string[] }} Normalized filters.
 */
function normalizePlpFilters(nextFilters) {
  const categoryIds = Array.isArray(nextFilters.categoryIds)
    ? nextFilters.categoryIds.filter(
        (categoryId) => typeof categoryId === "string",
      )
    : [];

  return {
    searchQuery: String(nextFilters.searchQuery || ""),
    minPrice: String(nextFilters.minPrice || ""),
    maxPrice: String(nextFilters.maxPrice || ""),
    categoryIds,
  };
}

export { readStoredPLPFilters, storePLPFilters, normalizePlpFilters };
