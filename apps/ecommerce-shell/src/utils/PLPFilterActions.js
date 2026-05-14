import { FILTER_STORAGE_KEY } from "./constants";

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

export { readStoredPLPFilters, storePLPFilters, normalizePlpFilters };
