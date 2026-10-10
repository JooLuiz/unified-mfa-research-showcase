/**
 * Live-availability watcher for the product details MFE.
 * Role: Starts and stops a subscription to the shared stock client for the currently loaded
 *   product, reporting the live "available" count back through a callback.
 * Not in this file: Component state or rendering (src/product-details.component.ts).
 * Key dependencies: @shared/stock-events.
 * See also: src/product-details.component.ts.
 */

import { createStockWatchClient } from "@shared/stock-events";
import type { Product } from "./product-details.types";

export type AvailabilityChangeCallback = (nextAvailable: number) => void;

export class ProductAvailabilityWatcher {
  private stopWatchingAvailability: (() => void) | null = null;

  constructor(private readonly onAvailableChange: AvailabilityChangeCallback) {}

  /**
   * Starts watching the given product's live availability, replacing any previous subscription.
   *
   * @param product - The currently loaded product, or null when nothing is loaded.
   * @param apiBaseUrl - The mock-data-service base url, or null when unknown.
   * @returns The product's initial available count, or null when it is not yet known.
   */
  startWatching(product: Product | null, apiBaseUrl: string | null): number | null {
    this.stopWatching();

    const initialAvailable = typeof product?.available === "number" ? product.available : null;
    if (!product || !apiBaseUrl) {
      return initialAvailable;
    }

    const stockClient = createStockWatchClient({ apiBaseUrl });
    this.stopWatchingAvailability = stockClient.watchProduct(product.id, this.onAvailableChange);
    return initialAvailable;
  }

  stopWatching(): void {
    if (this.stopWatchingAvailability) {
      this.stopWatchingAvailability();
      this.stopWatchingAvailability = null;
    }
  }
}
