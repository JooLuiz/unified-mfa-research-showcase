/**
 * Active filter tags for the product list page.
 * Role: Renders one removable tag per active filter; renders nothing when no filters are active.
 * Not in this file: Tag derivation (src/productListFilters.js) or filter state.
 * Key dependencies: None.
 * See also: src/ProductListView.js.
 */

import React from "react";

/**
 * Renders removable tags for the active filters.
 *
 * @param {object} props - Component props.
 * @param {Array<{ key: string, label: string }>} props.tags - Active filter tags.
 * @param {(filterKey: string) => void} props.onRemove - Removes a filter by tag key.
 * @returns {JSX.Element | null} Tag row, or null when empty.
 */
function ActiveFilterTags({ tags, onRemove }) {
  if (tags.length === 0) {
    return null;
  }

  return (
    <div className="active-filters">
      {tags.map((activeTag) => (
        <span key={activeTag.key} className="filter-tag">
          <span className="filter-tag-label">{activeTag.label}</span>
          <button
            type="button"
            className="filter-tag-remove"
            aria-label={`Remove filter ${activeTag.label}`}
            onClick={() => onRemove(activeTag.key)}
          >
            X
          </button>
        </span>
      ))}
    </div>
  );
}

export { ActiveFilterTags };
