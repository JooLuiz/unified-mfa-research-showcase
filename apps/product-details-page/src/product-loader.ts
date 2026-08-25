/**
 * Product fetching for the product details page.
 * Role: Owns the product HTTP request, URL product-id parsing, and abort/dedup bookkeeping.
 * Not in this file: Component state or rendering (src/product-details.component.ts).
 * Key dependencies: Mock data service GET /products/:productId.
 * See also: src/product-details.component.ts.
 */

import type { Product } from "./product-details.types";

/**
 * Reads the product id from the current URL query string.
 *
 * @returns The product id, or null when missing or blank.
 */
export function readProductIdFromQueryParams(): string | null {
  const queryParameters = new URLSearchParams(window.location.search);
  const rawValue = queryParameters.get("productId");
  const normalizedValue = typeof rawValue === "string" ? rawValue.trim() : "";
  return normalizedValue ? normalizedValue : null;
}

/**
 * Fetches a product by id.
 *
 * @param apiBaseUrl - Mock API base URL.
 * @param productId - Product identifier.
 * @param signal - Abort signal for the request.
 * @returns The fetched product.
 * @throws {Error} When the response is not ok.
 */
export async function fetchProductById(
  apiBaseUrl: string,
  productId: string,
  signal: AbortSignal,
): Promise<Product> {
  const response = await fetch(`${apiBaseUrl}/products/${productId}`, { signal });
  if (!response.ok) {
    throw new Error(
      `fetchProductById - request failed: ${response.status} ${response.statusText}`,
    );
  }
  return response.json();
}

/**
 * Tracks the in-flight product request so the component can dedup and abort loads.
 */
export class ProductRequestTracker {
  private activeAbortController?: AbortController;
  private lastLoadedProductId?: string;
  private lastLoadedApiBaseUrl?: string;

  /**
   * Reports whether the given product was already loaded from the given API.
   */
  hasLoaded(productId: string, apiBaseUrl: string): boolean {
    return (
      this.lastLoadedProductId === productId &&
      this.lastLoadedApiBaseUrl === apiBaseUrl
    );
  }

  /**
   * Marks a new load, aborting any previous request.
   *
   * @returns The abort controller for the new request.
   */
  begin(productId: string, apiBaseUrl: string): AbortController {
    this.abort();
    this.lastLoadedProductId = productId;
    this.lastLoadedApiBaseUrl = apiBaseUrl;
    const abortController = new AbortController();
    this.activeAbortController = abortController;
    return abortController;
  }

  /**
   * Clears the dedup markers without aborting the in-flight request.
   */
  reset(): void {
    this.lastLoadedProductId = undefined;
    this.lastLoadedApiBaseUrl = undefined;
  }

  /**
   * Aborts the in-flight request, if any.
   */
  abort(): void {
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = undefined;
    }
  }
}
