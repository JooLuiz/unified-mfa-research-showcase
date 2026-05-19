import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

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

async function fetchCategories(apiBaseUrl, signal) {
  const response = await fetch(`${apiBaseUrl}/categories`, { signal });
  if (!response.ok) {
    throw new Error(
      `fetchCategories - request failed: ${response.status} ${response.statusText}`,
    );
  }
  return response.json();
}

async function fetchFilteredProducts(apiBaseUrl, filters, sortBy, signal) {
  const queryString = buildProductsQueryString(filters, sortBy);
  const requestUrl = queryString
    ? `${apiBaseUrl}/products?${queryString}`
    : `${apiBaseUrl}/products`;
  const response = await fetch(requestUrl, { signal });
  if (!response.ok) {
    throw new Error(
      `fetchFilteredProducts - request failed: ${response.status} ${response.statusText}`,
    );
  }
  return response.json();
}

function ProductListView({
  products,
  categories,
  apiBaseUrl,
  initialFilters,
  initialSort,
  onFiltersChange,
  mountProductCard,
  onProductClick,
  onAddToCart,
}) {
  const normalizedInitialFilters = useMemo(
    () => normalizeFilters(initialFilters),
    [initialFilters],
  );

  const hasProvidedProducts = Array.isArray(products);
  const hasProvidedCategories = Array.isArray(categories);

  const cardSlotsRef = useRef([]);
  const [availableCategories, setAvailableCategories] = useState(
    hasProvidedCategories ? categories : [],
  );
  const [fetchedProducts, setFetchedProducts] = useState(
    hasProvidedProducts ? products : [],
  );
  const [activeFilters, setActiveFilters] = useState(normalizedInitialFilters);
  const [activeSort, setActiveSort] = useState(initialSort || "");
  const [itemsPerRow, setItemsPerRow] = useState(() => calculateItemsPerRow());
  const [visibleCount, setVisibleCount] = useState(() =>
    getInitialVisibleCount(calculateItemsPerRow()),
  );
  const [isFetchingProducts, setIsFetchingProducts] = useState(false);
  const [productsLoadError, setProductsLoadError] = useState(null);
  const [draftFilters, setDraftFilters] = useState(normalizedInitialFilters);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  useEffect(() => {
    if (hasProvidedCategories) {
      setAvailableCategories(categories);
      return undefined;
    }

    if (!apiBaseUrl) {
      return undefined;
    }
    const abortController = new AbortController();
    fetchCategories(apiBaseUrl, abortController.signal)
      .then((categoriesResponse) => {
        if (!abortController.signal.aborted) {
          setAvailableCategories(
            Array.isArray(categoriesResponse) ? categoriesResponse : [],
          );
        }
      })
      .catch((error) => {
        if (error.name === "AbortError") {
          return;
        }
        console.warn("ProductListView - categories error");
        console.warn(error);
      });

    return () => {
      abortController.abort();
    };
  }, [apiBaseUrl, categories, hasProvidedCategories]);

  useEffect(() => {
    if (hasProvidedProducts) {
      setFetchedProducts(products);
      setIsFetchingProducts(false);
      setProductsLoadError(null);
      return undefined;
    }

    if (!apiBaseUrl) {
      return undefined;
    }
    const abortController = new AbortController();
    setIsFetchingProducts(true);
    setProductsLoadError(null);

    fetchFilteredProducts(apiBaseUrl, activeFilters, activeSort, abortController.signal)
      .then((productsResponse) => {
        if (abortController.signal.aborted) {
          return;
        }
        const nextProducts = Array.isArray(productsResponse?.items)
          ? productsResponse.items
          : [];
        setFetchedProducts(nextProducts);
        setIsFetchingProducts(false);
      })
      .catch((error) => {
        if (error.name === "AbortError") {
          return;
        }
        console.warn("ProductListView - products error");
        console.warn(error);
        setProductsLoadError(error);
        setFetchedProducts([]);
        setIsFetchingProducts(false);
      });

    return () => {
      abortController.abort();
    };
  }, [
    apiBaseUrl,
    products,
    hasProvidedProducts,
    activeFilters.searchQuery,
    activeFilters.minPrice,
    activeFilters.maxPrice,
    activeFilters.categoryIds,
    activeSort,
  ]);

  useEffect(() => {
    function handleWindowResize() {
      const nextItemsPerRow = calculateItemsPerRow();
      setItemsPerRow((currentItemsPerRow) => {
        if (currentItemsPerRow === nextItemsPerRow) {
          return currentItemsPerRow;
        }
        setVisibleCount((currentVisibleCount) =>
          Math.max(currentVisibleCount, getInitialVisibleCount(nextItemsPerRow)),
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

  useEffect(() => {
    setDraftFilters(normalizedInitialFilters);
    setActiveFilters(normalizedInitialFilters);
    setVisibleCount(getInitialVisibleCount(itemsPerRow));
  }, [normalizedInitialFilters]);

  const notifyFiltersChange = useCallback(
    (nextFilters) => {
      if (typeof onFiltersChange === "function") {
        onFiltersChange(nextFilters);
      }
    },
    [onFiltersChange],
  );

  const visibleProducts = useMemo(
    () => fetchedProducts.slice(0, visibleCount),
    [fetchedProducts, visibleCount],
  );

  const totalProducts = fetchedProducts.length;
  const canLoadMore = visibleCount < totalProducts;

  const normalizeFilterValue = (value) => {
    if (String(value).trim() === "") {
      return "";
    }
    const parsedValue = Number(value);
    if (!Number.isFinite(parsedValue) || parsedValue < 0) {
      return "0";
    }
    return String(Math.floor(parsedValue));
  };

  const getNumericValue = (value) => {
    const parsedValue = Number(value);
    if (!Number.isFinite(parsedValue) || parsedValue < 0) {
      return 0;
    }
    return Math.floor(parsedValue);
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

  const applyFilters = () => {
    const nextFilters = normalizeFilters({
      searchQuery: draftFilters.searchQuery.trim(),
      minPrice: normalizeFilterValue(draftFilters.minPrice),
      maxPrice: normalizeFilterValue(draftFilters.maxPrice),
      categoryIds: draftFilters.categoryIds,
    });
    setActiveFilters(nextFilters);
    setVisibleCount(getInitialVisibleCount(itemsPerRow));
    notifyFiltersChange(nextFilters);
    if (typeof window !== "undefined" && window.innerWidth <= 768) {
      setIsMobileFiltersOpen(false);
    }
  };

  const clearFilters = () => {
    const clearedFilters = normalizeFilters({});
    setDraftFilters(clearedFilters);
    setActiveFilters(clearedFilters);
    setVisibleCount(getInitialVisibleCount(itemsPerRow));
    notifyFiltersChange(clearedFilters);
    if (typeof window !== "undefined" && window.innerWidth <= 768) {
      setIsMobileFiltersOpen(false);
    }
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

  const handleSortChange = (nextSortBy) => {
    setActiveSort(nextSortBy);
    setVisibleCount(getInitialVisibleCount(itemsPerRow));
  };

  const handleLoadMore = () => {
    setVisibleCount((currentVisibleCount) => currentVisibleCount + itemsPerRow);
  };

  const buildActiveFilterTags = () => {
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
  };

  const removeActiveFilter = (filterKey) => {
    const isCategoryRemoval = filterKey.startsWith("category:");
    const remainingCategoryIds = isCategoryRemoval
      ? activeFilters.categoryIds.filter(
          (selectedCategoryId) => `category:${selectedCategoryId}` !== filterKey,
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
    setVisibleCount(getInitialVisibleCount(itemsPerRow));
    notifyFiltersChange(nextFilters);
  };

  const activeFilterTags = buildActiveFilterTags();

  useEffect(() => {
    const cleanupFunctions = [];

    visibleProducts.forEach((product, index) => {
      const slotElement = cardSlotsRef.current[index];
      if (!slotElement) {
        return;
      }

      const cardProps = hasProvidedProducts
        ? { product, onProductClick, onAddToCart }
        : { productId: product.id, apiBaseUrl, onProductClick, onAddToCart };

      const cleanup = mountProductCard(slotElement, cardProps);
      cleanupFunctions.push(cleanup);
    });

    return () => {
      cleanupFunctions.forEach((cleanup) => {
        if (typeof cleanup === "function") {
          cleanup();
        }
      });
    };
  }, [
    visibleProducts,
    hasProvidedProducts,
    mountProductCard,
    onProductClick,
    onAddToCart,
    apiBaseUrl,
  ]);

  return (
    <section className="product-list-shell">
      <aside
        className={`product-filter-sidebar ${isMobileFiltersOpen ? "is-mobile-open" : "is-mobile-closed"}`}
      >
        <div className="mobile-filter-header">
          <h3>Filters</h3>
          <button
            className="mobile-filter-toggle-button"
            type="button"
            onClick={() => setIsMobileFiltersOpen((currentState) => !currentState)}
          >
            {isMobileFiltersOpen ? "Minimize" : "Expand"}
          </button>
        </div>
        <div className="filter-content">
          <label className="filter-label" htmlFor="searchInput">
            Search
          </label>
          <input
            id="searchInput"
            className="filter-search-input"
            type="text"
            value={draftFilters.searchQuery}
            placeholder="Search by id or name"
            onChange={(event) =>
              setDraftFilters((currentFilters) => ({
                ...currentFilters,
                searchQuery: event.target.value,
              }))
            }
          />

          <label className="filter-label" htmlFor="minPriceInput">
            Min Price
          </label>
          <div className="filter-quantity-shell">
            <button
              className="filter-quantity-button"
              type="button"
              onClick={() => adjustFilterValue("minPrice", -1)}
            >
              -
            </button>
            <input
              id="minPriceInput"
              className="filter-quantity-input"
              type="number"
              min="0"
              value={draftFilters.minPrice}
              onChange={(event) => handleFilterInputChange("minPrice", event.target.value)}
            />
            <button
              className="filter-quantity-button"
              type="button"
              onClick={() => adjustFilterValue("minPrice", 1)}
            >
              +
            </button>
          </div>

          <label className="filter-label" htmlFor="maxPriceInput">
            Max Price
          </label>
          <div className="filter-quantity-shell">
            <button
              className="filter-quantity-button"
              type="button"
              onClick={() => adjustFilterValue("maxPrice", -1)}
            >
              -
            </button>
            <input
              id="maxPriceInput"
              className="filter-quantity-input"
              type="number"
              min="0"
              value={draftFilters.maxPrice}
              onChange={(event) => handleFilterInputChange("maxPrice", event.target.value)}
            />
            <button
              className="filter-quantity-button"
              type="button"
              onClick={() => adjustFilterValue("maxPrice", 1)}
            >
              +
            </button>
          </div>

          <span className="filter-label">Categories</span>
          <div className="category-filter-list">
            {availableCategories.map((category) => (
              <label key={category.id} className="category-filter-option" htmlFor={`category-${category.id}`}>
                <input
                  id={`category-${category.id}`}
                  type="checkbox"
                  checked={draftFilters.categoryIds.includes(category.id)}
                  onChange={() => toggleCategorySelection(category.id)}
                />
                <span>{category.name}</span>
              </label>
            ))}
          </div>

          <button className="filter-action filter-clear-button" type="button" onClick={clearFilters}>
            Clear filters
          </button>
          <button className="filter-action filter-apply-button" type="button" onClick={applyFilters}>
            Apply filters
          </button>
        </div>
      </aside>
      <div className="product-list-main">
        <div className="product-list-controls">
          <h2>Products</h2>
          <div className="product-list-actions">
            <span className="total-quantity-label">Total Quantity: {totalProducts}</span>
            <select
              className="product-sort-select"
              value={activeSort}
              onChange={(event) => handleSortChange(event.target.value)}
            >
              <option value="">Product Sorting</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="name-asc">Name: A-Z</option>
            </select>
          </div>
        </div>
        {activeFilterTags.length > 0 && (
          <div className="active-filters">
            {activeFilterTags.map((activeTag) => (
              <span key={activeTag.key} className="filter-tag">
                <span className="filter-tag-label">{activeTag.label}</span>
                <button
                  type="button"
                  className="filter-tag-remove"
                  aria-label={`Remove filter ${activeTag.label}`}
                  onClick={() => removeActiveFilter(activeTag.key)}
                >
                  X
                </button>
              </span>
            ))}
          </div>
        )}
        {isFetchingProducts && visibleProducts.length === 0 ? (
          <p>Loading products...</p>
        ) : productsLoadError && visibleProducts.length === 0 ? (
          <p>Unable to load products.</p>
        ) : (
          <div className="product-grid">
            {visibleProducts.map((product, index) => (
              <div
                key={product.id}
                className="product-card-slot"
                ref={(element) => {
                  cardSlotsRef.current[index] = element;
                }}
              />
            ))}
          </div>
        )}
        {canLoadMore && (
          <button className="filter-action product-load-more-button" onClick={handleLoadMore}>
            Load More
          </button>
        )}
      </div>
    </section>
  );
}

export function mountProductList(containerElement, props) {
  const root = createRoot(containerElement);
  root.render(
    <ProductListView
      products={props.products}
      categories={props.categories}
      apiBaseUrl={props.apiBaseUrl}
      initialFilters={props.initialFilters}
      initialSort={props.initialSort}
      onFiltersChange={props.onFiltersChange}
      mountProductCard={props.mountProductCard}
      onProductClick={props.onProductClick}
      onAddToCart={props.onAddToCart}
    />,
  );

  return () => {
    root.unmount();
  };
}
