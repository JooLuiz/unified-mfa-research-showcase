import React, { useEffect, useMemo, useRef } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

function ProductListView({
  products,
  totalProducts,
  activeSort,
  activeFilters,
  onSortChange,
  onFiltersChange,
  onLoadMore,
  mountProductCard,
  onProductClick,
  onAddToCart,
}) {
  const cardSlotsRef = useRef([]);
  const productCount = useMemo(() => products.length, [products]);

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
      <aside>
        <h3>Filters</h3>
        <label>
          Min Price
          <input
            type="number"
            value={activeFilters.minPrice}
            onChange={(event) => onFiltersChange({ ...activeFilters, minPrice: event.target.value })}
          />
        </label>
        <label>
          Max Price
          <input
            type="number"
            value={activeFilters.maxPrice}
            onChange={(event) => onFiltersChange({ ...activeFilters, maxPrice: event.target.value })}
          />
        </label>
      </aside>
      <div>
        <div className="product-list-controls">
          <h2>Title (Products)</h2>
          <span>Total Quantity Of Products: {totalProducts}</span>
          <select value={activeSort} onChange={(event) => onSortChange(event.target.value)}>
            <option value="">Product Sorting</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="name-asc">Name: A-Z</option>
          </select>
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
        <button className="header-action" onClick={onLoadMore}>
          Load More ({productCount})
        </button>
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
      onSortChange={props.onSortChange}
      onFiltersChange={props.onFiltersChange}
      onLoadMore={props.onLoadMore}
      mountProductCard={props.mountProductCard}
      onProductClick={props.onProductClick}
      onAddToCart={props.onAddToCart}
    />,
  );

  return () => {
    root.unmount();
  };
}
