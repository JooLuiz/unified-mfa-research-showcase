/**
 * Filter sidebar for the product list page.
 * Role: Renders the search, price stepper, and category filter form with apply/clear actions.
 * Not in this file: Filter state (src/hooks/useProductListFilters.js) or result rendering.
 * Key dependencies: None.
 * See also: src/ProductListView.js.
 */

import React from "react";

/**
 * Renders the filter sidebar.
 *
 * @param {object} props - Component props.
 * @param {object} props.draftFilters - Draft filter values shown in the form.
 * @param {Array<{ id: string, name: string }>} props.availableCategories - Selectable categories.
 * @param {boolean} props.isMobileFiltersOpen - Whether the mobile panel is expanded.
 * @param {() => void} props.onToggleMobile - Toggles the mobile panel.
 * @param {(value: string) => void} props.onSearchChange - Updates the draft search query.
 * @param {(fieldName: string, value: string) => void} props.onFilterInputChange - Handles raw price input changes.
 * @param {(fieldName: string, delta: number) => void} props.onAdjustFilter - Steps a price field up or down.
 * @param {(categoryId: string) => void} props.onToggleCategory - Toggles a category checkbox.
 * @param {() => void} props.onClear - Clears all filters.
 * @param {() => void} props.onApply - Applies the draft filters.
 * @returns {JSX.Element} Filter sidebar.
 */
function ProductFilters({
  draftFilters,
  availableCategories,
  isMobileFiltersOpen,
  onToggleMobile,
  onSearchChange,
  onFilterInputChange,
  onAdjustFilter,
  onToggleCategory,
  onClear,
  onApply,
}) {
  return (
    <aside
      className={`product-filter-sidebar ${isMobileFiltersOpen ? "is-mobile-open" : "is-mobile-closed"}`}
    >
      <div className="mobile-filter-header">
        <h3>Filters</h3>
        <button
          className="mobile-filter-toggle-button"
          type="button"
          onClick={onToggleMobile}
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
          onChange={(event) => onSearchChange(event.target.value)}
        />

        <label className="filter-label" htmlFor="minPriceInput">
          Min Price
        </label>
        <div className="filter-quantity-shell">
          <button
            className="filter-quantity-button"
            type="button"
            onClick={() => onAdjustFilter("minPrice", -1)}
          >
            -
          </button>
          <input
            id="minPriceInput"
            className="filter-quantity-input"
            type="number"
            min="0"
            value={draftFilters.minPrice}
            onChange={(event) =>
              onFilterInputChange("minPrice", event.target.value)
            }
          />
          <button
            className="filter-quantity-button"
            type="button"
            onClick={() => onAdjustFilter("minPrice", 1)}
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
            onClick={() => onAdjustFilter("maxPrice", -1)}
          >
            -
          </button>
          <input
            id="maxPriceInput"
            className="filter-quantity-input"
            type="number"
            min="0"
            value={draftFilters.maxPrice}
            onChange={(event) =>
              onFilterInputChange("maxPrice", event.target.value)
            }
          />
          <button
            className="filter-quantity-button"
            type="button"
            onClick={() => onAdjustFilter("maxPrice", 1)}
          >
            +
          </button>
        </div>

        <span className="filter-label">Categories</span>
        <div className="category-filter-list">
          {availableCategories.map((category) => (
            <label
              key={category.id}
              className="category-filter-option"
              htmlFor={`category-${category.id}`}
            >
              <input
                id={`category-${category.id}`}
                type="checkbox"
                checked={draftFilters.categoryIds.includes(category.id)}
                onChange={() => onToggleCategory(category.id)}
              />
              <span>{category.name}</span>
            </label>
          ))}
        </div>

        <button
          className="filter-action filter-clear-button"
          type="button"
          onClick={onClear}
        >
          Clear filters
        </button>
        <button
          className="filter-action filter-apply-button"
          type="button"
          onClick={onApply}
        >
          Apply filters
        </button>
      </div>
    </aside>
  );
}

export { ProductFilters };
