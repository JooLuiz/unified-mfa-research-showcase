/**
 * Product-list filter persistence and the cross-shell query-param handoff.
 * Role: Restores, stores, and normalizes PLP filters, and applies promotional filters carried on the /products URL.
 * Not in this file: Product list rendering (src/pages/catalogPages.js) or in-shell promotion navigation (src/pages/promotionsPage.js).
 * Key dependencies: localStorage key ecommerce-shell:plp-filters from src/utils/constants.js.
 * See also: COMMUNICATION_METHODS.md (query-param contract); apps/social-media-shell/src/pages/postsPage.js (builds the URL).
 */

import { FILTER_STORAGE_KEY } from "./constants";

const PROMOTIONAL_FILTER_QUERY_KEYS = [
  "searchQuery",
  "minPrice",
  "maxPrice",
  "categoryIds",
];

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

function storePLPFilters(appState) {
  localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(appState.plpFilters));
}

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

/**
 * Reads promotional filters from a product-list search string.
 *
 * @param {string} search - Location search, with or without a leading "?".
 * @returns {{ searchQuery: string, minPrice: string, maxPrice: string, categoryIds: string[] } | null} Normalized filters when any promotional param is non-empty, otherwise null.
 */
function readPlpFiltersFromSearch(search) {
  const queryString = search.startsWith("?") ? search.slice(1) : String(search || "");
  const queryParams = new URLSearchParams(queryString);
  const hasPromotionalFilter = PROMOTIONAL_FILTER_QUERY_KEYS.some((queryKey) => {
    const queryValue = queryParams.get(queryKey);
    return queryValue != null && queryValue.trim() !== "";
  });
  if (!hasPromotionalFilter) {
    return null;
  }

  const categoryIds = String(queryParams.get("categoryIds") || "")
    .split(",")
    .map((categoryId) => categoryId.trim())
    .filter(Boolean);

  return normalizePlpFilters({
    searchQuery: queryParams.get("searchQuery") || "",
    minPrice: queryParams.get("minPrice") || "",
    maxPrice: queryParams.get("maxPrice") || "",
    categoryIds,
  });
}

/**
 * Replaces shell PLP filters when the page URL carries promotional query params.
 *
 * @param {object} appState - Shell state holding plpFilters.
 * @param {string} [search] - Location search to read. Defaults to the current page search.
 * @returns {boolean} True when the URL replaced the stored filters.
 * @sideEffects Writes ecommerce-shell:plp-filters when the URL contains promotional filters.
 */
function applyPlpFiltersFromLocation(appState, search = window.location.search) {
  const filtersFromSearch = readPlpFiltersFromSearch(search);
  if (!filtersFromSearch) {
    return false;
  }
  appState.plpFilters = filtersFromSearch;
  storePLPFilters(appState);
  return true;
}

export {
  readStoredPLPFilters,
  storePLPFilters,
  normalizePlpFilters,
  applyPlpFiltersFromLocation,
};
