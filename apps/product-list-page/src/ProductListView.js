/**
 * Root view for the product list page.
 * Role: Composes data, filter, and grid hooks with the sidebar, toolbar, tags, and grid components;
 *       also registers the product card element and pushes props into card slots.
 * Not in this file: Filter logic (src/hooks/), presentational markup (src/components/), or mounting (src/product-list.js).
 * Key dependencies: product_card/ProductCardElement remote (dynamically imported).
 * See also: src/product-list.js.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useResponsiveGrid } from "./hooks/useResponsiveGrid";
import { useProductListFilters } from "./hooks/useProductListFilters";
import { useProductListData } from "./hooks/useProductListData";
import { buildActiveFilterTags } from "./productListFilters";
import { ProductFilters } from "./components/ProductFilters";
import { ProductListToolbar } from "./components/ProductListToolbar";
import { ActiveFilterTags } from "./components/ActiveFilterTags";
import { ProductGrid } from "./components/ProductGrid";

/**
 * Renders the product list page.
 *
 * @param {object} props - Component props.
 * @param {Array} [props.products] - Host-provided products; disables fetching when set.
 * @param {Array} [props.categories] - Host-provided categories; disables fetching when set.
 * @param {string} [props.apiBaseUrl] - Mock API base URL.
 * @param {object} [props.initialFilters] - Initial filter values from the host.
 * @param {string} [props.initialSort] - Initial sort key from the host.
 * @param {(nextFilters: object) => void} [props.onFiltersChange] - Notifies the host of applied filter changes.
 * @param {(productId: string) => void} [props.onProductClick] - Handles product card clicks.
 * @param {(payload: object) => void} [props.onAddToCart] - Handles add-to-cart actions.
 * @returns {JSX.Element} Product list page.
 */
function ProductListView({
  products,
  categories,
  apiBaseUrl,
  initialFilters,
  initialSort,
  onFiltersChange,
  onProductClick,
  onAddToCart,
}) {
  const cardSlotsRef = useRef([]);
  const [isCardElementReady, setIsCardElementReady] = useState(false);

  const { visibleCount, resetVisibleCount, loadMore } = useResponsiveGrid();

  const {
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
  } = useProductListFilters({
    initialFilters,
    initialSort,
    onFiltersChange,
    onFiltersApplied: resetVisibleCount,
  });

  const {
    availableCategories,
    fetchedProducts,
    isFetchingProducts,
    productsLoadError,
    hasProvidedProducts,
  } = useProductListData({
    apiBaseUrl,
    providedProducts: products,
    providedCategories: categories,
    activeFilters,
    activeSort,
  });

  useEffect(() => {
    let isActive = true;
    import("product_card/ProductCardElement")
      .then((productCardElementModule) => {
        productCardElementModule.registerProductCardElement();
        if (isActive) {
          setIsCardElementReady(true);
        }
      })
      .catch((importError) => {
        console.warn("ProductListView - product card element importError");
        console.warn(importError);
      });

    return () => {
      isActive = false;
    };
  }, []);

  const visibleProducts = useMemo(
    () => fetchedProducts.slice(0, visibleCount),
    [fetchedProducts, visibleCount],
  );

  const totalProducts = fetchedProducts.length;
  const canLoadMore = visibleCount < totalProducts;
  const activeFilterTags = buildActiveFilterTags(activeFilters, availableCategories);

  useEffect(() => {
    if (!isCardElementReady) {
      return;
    }

    visibleProducts.forEach((product, index) => {
      const cardElement = cardSlotsRef.current[index];
      if (!cardElement) {
        return;
      }

      cardElement.props = hasProvidedProducts
        ? { product, onProductClick, onAddToCart }
        : { productId: product.id, apiBaseUrl, onProductClick, onAddToCart };
    });
  }, [
    isCardElementReady,
    visibleProducts,
    hasProvidedProducts,
    onProductClick,
    onAddToCart,
    apiBaseUrl,
  ]);

  return (
    <section className="product-list-shell">
      <ProductFilters
        draftFilters={draftFilters}
        availableCategories={availableCategories}
        isMobileFiltersOpen={isMobileFiltersOpen}
        onToggleMobile={toggleMobileFilters}
        onSearchChange={updateSearchQuery}
        onFilterInputChange={handleFilterInputChange}
        onAdjustFilter={adjustFilterValue}
        onToggleCategory={toggleCategorySelection}
        onClear={clearFilters}
        onApply={applyFilters}
      />
      <div className="product-list-main">
        <ProductListToolbar
          totalProducts={totalProducts}
          activeSort={activeSort}
          onSortChange={handleSortChange}
        />
        <ActiveFilterTags
          tags={activeFilterTags}
          onRemove={removeActiveFilter}
        />
        <ProductGrid
          visibleProducts={visibleProducts}
          cardSlotsRef={cardSlotsRef}
          isFetchingProducts={isFetchingProducts}
          productsLoadError={productsLoadError}
          canLoadMore={canLoadMore}
          onLoadMore={loadMore}
        />
      </div>
    </section>
  );
}

export { ProductListView };
