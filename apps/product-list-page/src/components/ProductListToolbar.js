/**
 * Toolbar for the product list page.
 * Role: Renders the total product count and the sort selector.
 * Not in this file: Sort state (src/hooks/useProductListFilters.js) or the product grid.
 * Key dependencies: None.
 * See also: src/ProductListView.js.
 */

import React from "react";

/**
 * Renders the list header with total count and sort select.
 *
 * @param {object} props - Component props.
 * @param {number} props.totalProducts - Total number of loaded products.
 * @param {string} props.activeSort - Active sort key, or "" for none.
 * @param {(nextSortBy: string) => void} props.onSortChange - Handles sort selection changes.
 * @returns {JSX.Element} Toolbar row.
 */
function ProductListToolbar({ totalProducts, activeSort, onSortChange }) {
  return (
    <div className="product-list-controls">
      <h2>Products</h2>
      <div className="product-list-actions">
        <span className="total-quantity-label">
          Total Quantity: {totalProducts}
        </span>
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
  );
}

export { ProductListToolbar };
