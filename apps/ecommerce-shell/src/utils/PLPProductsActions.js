function calculatePlpItemsPerRow() {
  const minimumCardWidth = 170;
  const cardGap = 12;
  const filtersColumnWidth = 220;
  const pagePaddingAllowance = 96;
  const estimatedGridWidth = Math.max(
    window.innerWidth - filtersColumnWidth - pagePaddingAllowance,
    minimumCardWidth,
  );

  const estimatedCardsPerRow = Math.floor(
    (estimatedGridWidth + cardGap) / (minimumCardWidth + cardGap),
  );
  return Math.max(estimatedCardsPerRow, 1);
}

function getPlpInitialVisibleCount(itemsPerRow) {
  let finalItemsPerRow;

  if (!itemsPerRow || typeof itemsPerRow !== "number") {
    finalItemsPerRow = calculatePlpItemsPerRow();
  } else {
    finalItemsPerRow = itemsPerRow;
  }

  return Math.max(finalItemsPerRow * 2, 2);
}

function filterProducts(appState, products) {
  const searchQuery = String(appState.plpFilters.searchQuery || "")
    .toLowerCase()
    .trim();
  const selectedCategoryIds = Array.isArray(appState.plpFilters.categoryIds)
    ? appState.plpFilters.categoryIds
    : [];
  const hasMinimumFilter = String(appState.plpFilters.minPrice).trim() !== "";
  const hasMaximumFilter = String(appState.plpFilters.maxPrice).trim() !== "";
  const minPrice = hasMinimumFilter
    ? Number(appState.plpFilters.minPrice)
    : null;
  const maxPrice = hasMaximumFilter
    ? Number(appState.plpFilters.maxPrice)
    : null;

  let filteredProducts = products.filter((product) => {
    const normalizedProductName = String(product.name || "").toLowerCase();
    const normalizedProductId = String(product.id || "").toLowerCase();
    const matchesSearch =
      searchQuery === "" ||
      normalizedProductName.includes(searchQuery) ||
      normalizedProductId.includes(searchQuery);
    const matchesCategory =
      selectedCategoryIds.length === 0 ||
      selectedCategoryIds.includes(product.categoryId);
    const isAboveMinimum = Number.isFinite(minPrice)
      ? product.price >= minPrice
      : true;
    const isBelowMaximum = Number.isFinite(maxPrice)
      ? product.price <= maxPrice
      : true;
    return matchesSearch && matchesCategory && isAboveMinimum && isBelowMaximum;
  });

  if (appState.plpSortBy === "price-asc") {
    filteredProducts = filteredProducts.sort(
      (firstProduct, secondProduct) => firstProduct.price - secondProduct.price,
    );
  }

  if (appState.plpSortBy === "price-desc") {
    filteredProducts = filteredProducts.sort(
      (firstProduct, secondProduct) => secondProduct.price - firstProduct.price,
    );
  }

  if (appState.plpSortBy === "name-asc") {
    filteredProducts = filteredProducts.sort((firstProduct, secondProduct) =>
      firstProduct.name.localeCompare(secondProduct.name),
    );
  }

  return filteredProducts;
}

export { calculatePlpItemsPerRow, getPlpInitialVisibleCount, filterProducts };
