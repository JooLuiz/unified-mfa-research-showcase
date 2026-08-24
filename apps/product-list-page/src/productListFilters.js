/**
 * Pure filter helpers for the product list page.
 * Role: Owns filter normalization, query-string building, numeric coercion, and active-tag labels.
 * Not in this file: Filter state, fetching, or rendering (hooks/ and components/).
 * Key dependencies: None.
 * See also: src/hooks/useProductListFilters.js.
 */

/**
 * Normalizes raw filter input into the canonical filter shape.
 *
 * @param {object} rawFilters - Untrusted filter values.
 * @returns {{ searchQuery: string, minPrice: string, maxPrice: string, categoryIds: string[] }} Normalized filters.
 */
function normalizeFilters(rawFilters) {
  const filterValues = rawFilters || {};
  const categoryIds = Array.isArray(filterValues.categoryIds)
    ? filterValues.categoryIds.filter(
        (categoryId) => typeof categoryId === "string",
      )
    : [];

  return {
    searchQuery: String(filterValues.searchQuery || ""),
    minPrice: String(filterValues.minPrice || ""),
    maxPrice: String(filterValues.maxPrice || ""),
    categoryIds,
  };
}

/**
 * Builds the products endpoint query string for the given filters and sort.
 *
 * @param {object} filters - Normalized filters.
 * @param {string} sortBy - Active sort key, or "" for none.
 * @returns {string} Encoded query string, possibly empty.
 */
function buildProductsQueryString(filters, sortBy) {
  const queryParams = new URLSearchParams();
  if (filters.searchQuery) {
    queryParams.set("search", filters.searchQuery);
  }
  if (filters.minPrice !== "") {
    queryParams.set("minPrice", filters.minPrice);
  }
  if (filters.maxPrice !== "") {
    queryParams.set("maxPrice", filters.maxPrice);
  }
  if (filters.categoryIds.length > 0) {
    queryParams.set("categoryIds", filters.categoryIds.join(","));
  }
  if (sortBy) {
    queryParams.set("sortBy", sortBy);
  }
  return queryParams.toString();
}

/**
 * Coerces a draft price input into a normalized non-negative integer string.
 *
 * @param {string} value - Raw draft input value.
 * @returns {string} "" for empty input, otherwise a floored non-negative integer string.
 */
function normalizeFilterValue(value) {
  if (String(value).trim() === "") {
    return "";
  }
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    return "0";
  }
  return String(Math.floor(parsedValue));
}

/**
 * Reads a draft price input as a non-negative integer number.
 *
 * @param {string} value - Raw draft input value.
 * @returns {number} Floored non-negative integer, or 0 for invalid input.
 */
function getNumericValue(value) {
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    return 0;
  }
  return Math.floor(parsedValue);
}

/**
 * Builds removable tag descriptors for the currently active filters.
 *
 * @param {object} activeFilters - Normalized active filters.
 * @param {Array<{ id: string, name: string }>} availableCategories - Categories used to resolve tag labels.
 * @returns {Array<{ key: string, label: string }>} Active filter tags.
 */
function buildActiveFilterTags(activeFilters, availableCategories) {
  const activeTags = [];

  if (activeFilters.searchQuery) {
    activeTags.push({
      key: "searchQuery",
      label: `Search: ${activeFilters.searchQuery}`,
    });
  }

  if (String(activeFilters.minPrice || "").trim() !== "") {
    activeTags.push({
      key: "minPrice",
      label: `Min Price: $${activeFilters.minPrice}`,
    });
  }

  if (String(activeFilters.maxPrice || "").trim() !== "") {
    activeTags.push({
      key: "maxPrice",
      label: `Max Price: $${activeFilters.maxPrice}`,
    });
  }

  activeFilters.categoryIds.forEach((selectedCategoryId) => {
    const matchingCategory = availableCategories.find(
      (category) => category.id === selectedCategoryId,
    );
    activeTags.push({
      key: `category:${selectedCategoryId}`,
      label: `Category: ${matchingCategory?.name || selectedCategoryId}`,
    });
  });

  return activeTags;
}

export {
  normalizeFilters,
  buildProductsQueryString,
  normalizeFilterValue,
  getNumericValue,
  buildActiveFilterTags,
};
