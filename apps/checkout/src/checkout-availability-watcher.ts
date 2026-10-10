/**
 * Live-availability watcher for the checkout items list.
 * Role: Keeps one shared-stock-client subscription per cart line's product id, adding and
 *   removing subscriptions as the rendered line set changes, and reporting each line's live
 *   "available" count back through a callback.
 * Not in this file: Component state or rendering (src/checkout-items.ts).
 * Key dependencies: @shared/stock-events.
 * See also: src/checkout-items.ts.
 */

import { createStockWatchClient } from "@shared/stock-events";

export type AvailabilityByProductIdChangeCallback = (
  productId: string,
  nextAvailable: number,
) => void;

export class CheckoutAvailabilityWatcher {
  private readonly stopWatchingByProductId = new Map<string, () => void>();

  private apiBaseUrl: string | null = null;

  constructor(private readonly onAvailableChange: AvailabilityByProductIdChangeCallback) {}

  setApiBaseUrl(apiBaseUrl: string | null): void {
    this.apiBaseUrl = apiBaseUrl;
  }

  /**
   * Starts watching any newly-rendered product ids and stops watching ones no longer rendered.
   *
   * @param productIds - The product ids currently rendered as checkout lines.
   */
  syncWatchedProductIds(productIds: string[]): void {
    if (!this.apiBaseUrl) {
      return;
    }

    const nextProductIds = new Set(productIds);

    for (const [productId, stopWatching] of this.stopWatchingByProductId) {
      if (!nextProductIds.has(productId)) {
        stopWatching();
        this.stopWatchingByProductId.delete(productId);
      }
    }

    const stockClient = createStockWatchClient({ apiBaseUrl: this.apiBaseUrl });
    for (const productId of nextProductIds) {
      if (this.stopWatchingByProductId.has(productId)) {
        continue;
      }
      const stopWatching = stockClient.watchProduct(productId, (nextAvailable) => {
        this.onAvailableChange(productId, nextAvailable);
      });
      this.stopWatchingByProductId.set(productId, stopWatching);
    }
  }

  stopWatchingAll(): void {
    for (const stopWatching of this.stopWatchingByProductId.values()) {
      stopWatching();
    }
    this.stopWatchingByProductId.clear();
  }
}
