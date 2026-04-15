import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

function ProductListView({
  products,
  totalProducts,
  activeSort,
  activeFilters,
  categories,
  onSortChange,
  onApplyFilters,
  onClearFilters,
  onLoadMore,
  canLoadMore,
  mountProductCard,
  onProductClick,
  onAddToCart,
}) {
  const cardSlotsRef = useRef([]);
  const availableCategories = Array.isArray(categories) ? categories : [];
  const [draftFilters, setDraftFilters] = useState({
    searchQuery: activeFilters.searchQuery || "",
    minPrice: activeFilters.minPrice || "",
    maxPrice: activeFilters.maxPrice || "",
    categoryIds: Array.isArray(activeFilters.categoryIds)
      ? activeFilters.categoryIds
      : [],
  });
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

  useEffect(() => {
    setDraftFilters({
      searchQuery: activeFilters.searchQuery || "",
      minPrice: activeFilters.minPrice || "",
      maxPrice: activeFilters.maxPrice || "",
      categoryIds: Array.isArray(activeFilters.categoryIds)
        ? activeFilters.categoryIds
        : [],
    });
  }, [
    activeFilters.searchQuery,
    activeFilters.minPrice,
    activeFilters.maxPrice,
    activeFilters.categoryIds,
  ]);

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
    onApplyFilters({
      searchQuery: draftFilters.searchQuery.trim(),
      minPrice: normalizeFilterValue(draftFilters.minPrice),
      maxPrice: normalizeFilterValue(draftFilters.maxPrice),
      categoryIds: draftFilters.categoryIds,
    });
    if (typeof window !== "undefined" && window.innerWidth <= 768) {
      setIsMobileFiltersOpen(false);
    }
  };

  const clearFilters = () => {
    const clearedFilters = {
      searchQuery: "",
      minPrice: "",
      maxPrice: "",
      categoryIds: [],
    };
    setDraftFilters(clearedFilters);
    onClearFilters(clearedFilters);
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
          ? currentFilters.categoryIds.filter((selectedCategoryId) => selectedCategoryId !== categoryId)
          : [...currentFilters.categoryIds, categoryId],
      };
    });
  };

  useEffect(() => {
    const cleanupFunctions = [];

    products.forEach((product, index) => {
      const slotElement = cardSlotsRef.current[index];
      if (!slotElement) {
        return;
      }

      const cleanup = mountProductCard(slotElement, {
        product,
        onProductClick,
        onAddToCart,
      });
      cleanupFunctions.push(cleanup);
    });

    return () => {
      cleanupFunctions.forEach((cleanup) => {
        if (typeof cleanup === "function") {
          cleanup();
        }
      });
    };
  }, [products, mountProductCard, onProductClick, onAddToCart]);

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

          <button className="header-action filter-clear-button" type="button" onClick={clearFilters}>
            Clear filters
          </button>
          <button className="header-action filter-apply-button" type="button" onClick={applyFilters}>
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
              onChange={(event) => onSortChange(event.target.value)}
            >
              <option value="">Product Sorting</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="name-asc">Name: A-Z</option>
            </select>
          </div>
        </div>
        <div className="product-grid">
          {products.map((product, index) => (
            <div
              key={product.id}
              className="product-card-slot"
              ref={(element) => {
                cardSlotsRef.current[index] = element;
              }}
            />
          ))}
        </div>
        {canLoadMore && (
          <button className="header-action product-load-more-button" onClick={onLoadMore}>
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
      totalProducts={props.totalProducts}
      activeSort={props.activeSort}
      activeFilters={props.activeFilters}
      categories={props.categories}
      onSortChange={props.onSortChange}
      onApplyFilters={props.onApplyFilters}
      onClearFilters={props.onClearFilters}
      onLoadMore={props.onLoadMore}
      canLoadMore={props.canLoadMore}
      mountProductCard={props.mountProductCard}
      onProductClick={props.onProductClick}
      onAddToCart={props.onAddToCart}
    />,
  );

  return () => {
    root.unmount();
  };
}
