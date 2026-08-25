/**
 * Product grid for the product list page.
 * Role: Renders loading, error, and empty states plus the vue-product-card slots and load-more button.
 * Not in this file: Card prop assignment (src/ProductListView.js) or grid window state (src/hooks/useResponsiveGrid.js).
 * Key dependencies: vue-product-card custom element registered by the product-card remote.
 * See also: src/ProductListView.js.
 */

import React from "react";

/**
 * Renders the product result area.
 *
 * @param {object} props - Component props.
 * @param {Array} props.visibleProducts - Products inside the current visible window.
 * @param {React.MutableRefObject<Array<HTMLElement | null>>} props.cardSlotsRef - Slot elements receiving card props.
 * @param {boolean} props.isFetchingProducts - Whether a product request is in flight.
 * @param {Error | null} props.productsLoadError - Last product load error, if any.
 * @param {boolean} props.canLoadMore - Whether more products can be revealed.
 * @param {() => void} props.onLoadMore - Reveals the next row of products.
 * @returns {JSX.Element} Result area.
 */
function ProductGrid({
  visibleProducts,
  cardSlotsRef,
  isFetchingProducts,
  productsLoadError,
  canLoadMore,
  onLoadMore,
}) {
  return (
    <>
      {isFetchingProducts && visibleProducts.length === 0 ? (
        <p>Loading products...</p>
      ) : productsLoadError && visibleProducts.length === 0 ? (
        <p>Unable to load products.</p>
      ) : (
        <div className="product-grid">
          {visibleProducts.map((product, index) => (
            <vue-product-card
              key={product.id}
              class="product-card-slot"
              ref={(element) => {
                cardSlotsRef.current[index] = element;
              }}
            />
          ))}
        </div>
      )}
      {canLoadMore && (
        <button
          className="filter-action product-load-more-button"
          onClick={onLoadMore}
        >
          Load More
        </button>
      )}
    </>
  );
}

export { ProductGrid };
