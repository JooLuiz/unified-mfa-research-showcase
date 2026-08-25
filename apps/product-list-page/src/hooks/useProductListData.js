/**
 * Data loading for the product list page.
 * Role: Owns category and product fetching with abort-aware lifecycle, honoring host-provided data.
 * Not in this file: Filter state (src/hooks/useProductListFilters.js) or rendering.
 * Key dependencies: Mock data service via src/productListApi.js.
 * See also: src/ProductListView.js.
 */

import { useEffect, useState } from "react";
import { fetchCategories, fetchFilteredProducts } from "../productListApi";

/**
 * Loads categories and products, skipping fetches when the host provides the data.
 *
 * @param {object} options - Hook options.
 * @param {string} options.apiBaseUrl - Mock API base URL.
 * @param {Array | undefined} options.providedProducts - Host-provided products; disables product fetching when an array.
 * @param {Array | undefined} options.providedCategories - Host-provided categories; disables category fetching when an array.
 * @param {object} options.activeFilters - Normalized active filters driving the product query.
 * @param {string} options.activeSort - Active sort key driving the product query.
 * @returns {{ availableCategories: Array, fetchedProducts: Array, isFetchingProducts: boolean, productsLoadError: Error | null, hasProvidedProducts: boolean }} Loaded data and request state.
 * @sideEffects Performs HTTP requests aborted on unmount or dependency change.
 */
function useProductListData({
  apiBaseUrl,
  providedProducts,
  providedCategories,
  activeFilters,
  activeSort,
}) {
  const hasProvidedProducts = Array.isArray(providedProducts);
  const hasProvidedCategories = Array.isArray(providedCategories);

  const [availableCategories, setAvailableCategories] = useState(
    hasProvidedCategories ? providedCategories : [],
  );
  const [fetchedProducts, setFetchedProducts] = useState(
    hasProvidedProducts ? providedProducts : [],
  );
  const [isFetchingProducts, setIsFetchingProducts] = useState(false);
  const [productsLoadError, setProductsLoadError] = useState(null);

  useEffect(() => {
    if (hasProvidedCategories) {
      setAvailableCategories(providedCategories);
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
        console.warn("useProductListData - categories error");
        console.warn(error);
      });

    return () => {
      abortController.abort();
    };
  }, [apiBaseUrl, providedCategories, hasProvidedCategories]);

  useEffect(() => {
    if (hasProvidedProducts) {
      setFetchedProducts(providedProducts);
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

    fetchFilteredProducts(
      apiBaseUrl,
      activeFilters,
      activeSort,
      abortController.signal,
    )
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
        console.warn("useProductListData - products error");
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
    providedProducts,
    hasProvidedProducts,
    activeFilters.searchQuery,
    activeFilters.minPrice,
    activeFilters.maxPrice,
    activeFilters.categoryIds,
    activeSort,
  ]);

  return {
    availableCategories,
    fetchedProducts,
    isFetchingProducts,
    productsLoadError,
    hasProvidedProducts,
  };
}

export { useProductListData };
