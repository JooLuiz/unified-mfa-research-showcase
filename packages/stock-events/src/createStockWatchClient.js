/**
 * Public per-tab stock watch client.
 * Role: Module-level singleton (one per apiBaseUrl) that lets any mounted component register
 *   interest in a product's live availability without opening its own connection.
 * Not in this file: The underlying EventSource/reconnect mechanics (src/createStockWatchStream.js).
 * Key dependencies: src/createStockWatchEvents.js; src/createStockWatchStream.js.
 * See also: apps/product-card/src/product-card-component.js;
 *   apps/product-details-page/src/product-details.component.ts;
 *   apps/checkout/src/checkout-items.ts; apps/ecommerce-shell/src/main.js.
 */

import { createStockWatchEvents } from "./createStockWatchEvents.js";
import { createStockWatchStream } from "./createStockWatchStream.js";

/** @type {Map<string, { stream: ReturnType<typeof createStockWatchStream>, stockWatchEvents: ReturnType<typeof createStockWatchEvents>, watcherCountByProductId: Map<string, number>, syncWatchedProductIds: () => void }>} */
const streamEntriesByApiBaseUrl = new Map();

function getOrCreateStreamEntry(apiBaseUrl) {
  const existingEntry = streamEntriesByApiBaseUrl.get(apiBaseUrl);
  if (existingEntry) {
    return existingEntry;
  }

  const stream = createStockWatchStream({ apiBaseUrl });
  /** @type {Set<(message: { payload?: { productId?: string, available?: number } }) => void>} */
  const inboundCallbacks = new Set();
  const stockWatchEvents = createStockWatchEvents({
    subscribe(_topic, _event, callback) {
      inboundCallbacks.add(callback);
      return function unsubscribeFromStockChanged() {
        inboundCallbacks.delete(callback);
      };
    },
  });

  stream.subscribeToStockChanged((productId, available) => {
    inboundCallbacks.forEach((callback) => callback({ payload: { productId, available } }));
  });

  /** @type {Map<string, number>} */
  const watcherCountByProductId = new Map();

  function syncWatchedProductIds() {
    stream.setWatchedProductIds(Array.from(watcherCountByProductId.keys()));
  }

  const entry = { stream, stockWatchEvents, watcherCountByProductId, syncWatchedProductIds };
  streamEntriesByApiBaseUrl.set(apiBaseUrl, entry);
  return entry;
}

/**
 * Returns the shared stock watch client for one API base url. Creating it (if not already
 * created by an earlier caller in this tab) opens the tab's single stock stream immediately;
 * the stream stays open for the life of the tab, independent of this client's own lifetime.
 *
 * @param {{ apiBaseUrl: string }} clientInput - Mock API base URL.
 * @returns {{
 *   watchProduct: (productId: string, onAvailableChange: (available: number) => void) => () => void,
 *   subscribeToReconnect: (listener: () => void) => () => void,
 * }} The watch client.
 */
function createStockWatchClient({ apiBaseUrl }) {
  const entry = getOrCreateStreamEntry(apiBaseUrl);

  /**
   * Registers interest in one product's live availability.
   *
   * @param {string} productId - Catalog product id.
   * @param {(available: number) => void} onAvailableChange - Called with every pushed count.
   * @returns {() => void} Unwatch function; call it on unmount or when the product id changes.
   * @sideEffects Syncs the tab's watched-product-id set to the server when this is the first or last listener for that product.
   */
  function watchProduct(productId, onAvailableChange) {
    const currentCount = entry.watcherCountByProductId.get(productId) || 0;
    entry.watcherCountByProductId.set(productId, currentCount + 1);
    if (currentCount === 0) {
      entry.syncWatchedProductIds();
    }
    const unwatchEvents = entry.stockWatchEvents.watchProduct(productId, onAvailableChange);

    return function unwatchProduct() {
      unwatchEvents();
      const nextCount = (entry.watcherCountByProductId.get(productId) || 1) - 1;
      if (nextCount <= 0) {
        entry.watcherCountByProductId.delete(productId);
        entry.syncWatchedProductIds();
        return;
      }
      entry.watcherCountByProductId.set(productId, nextCount);
    };
  }

  return {
    watchProduct,
    subscribeToReconnect: entry.stream.subscribeToReconnect,
  };
}

export { createStockWatchClient };
