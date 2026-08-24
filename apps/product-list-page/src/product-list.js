/**
 * Module Federation entry for the product list page MFE.
 * Role: Exposes mountProductList to host shells; all view logic lives in ProductListView, hooks/, and components/.
 * Not in this file: State, fetching, or presentational markup.
 * Key dependencies: React root API; src/styles.css.
 * See also: src/ProductListView.js.
 */

import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { ProductListView } from "./ProductListView";

/**
 * Mounts the product list page into a host container.
 *
 * @param {HTMLElement} containerElement - Host-owned mount element.
 * @param {object} props - ProductListView props (products, categories, apiBaseUrl, filters, callbacks).
 * @returns {() => void} Cleanup that unmounts the React root.
 */
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
      onProductClick={props.onProductClick}
      onAddToCart={props.onAddToCart}
    />,
  );

  return () => {
    root.unmount();
  };
}
