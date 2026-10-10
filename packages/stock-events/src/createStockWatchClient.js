/**
 * Public per-tab stock watch client.
 * Role: Module-level singleton (one per apiBaseUrl) that lets any mounted component register
 *   interest in a product's live availability without opening its own connection.
 * Not in this file: The underlying EventSource/reconnect mechanics (src/createStockWatchStream.js).
 * Key dependencies: src/createStockWatchStream.js.
 * See also: apps/product-card/src/product-card-component.js;
 *   apps/product-details-page/src/product-details.component.ts;
 *   apps/checkout/src/checkout-items.ts; apps/ecommerce-shell/src/main.js.
 */

import { createStockWatchStream } from "./createStockWatchStream.js";

/** @type {Map<string, { stream: ReturnType<typeof createStockWatchStream>, listenersByProductId: Map<string, Set<(available: number) => void>>, syncWatchedProductIds: () => void }>} */
const streamEntriesByApiBaseUrl = new Map();

function getOrCreateStreamEntry(apiBaseUrl) {
  const existingEntry = streamEntriesByApiBaseUrl.get(apiBaseUrl);
  if (existingEntry) {
    return existingEntry;
  }

  const stream = createStockWatchStream({ apiBaseUrl });
  const listenersByProductId = new Map();

  function syncWatchedProductIds() {
    stream.setWatchedProductIds(Array.from(listenersByProductId.keys()));
  }

  stream.subscribeToStockChanged((productId, available) => {
    const listeners = listenersByProductId.get(productId);
    if (!listeners) {
      return;
    }
    listeners.forEach((listener) => listener(available));
  });

  const entry = { stream, listenersByProductId, syncWatchedProductIds };
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
    const listeners = entry.listenersByProductId.get(productId) || new Set();
    const isFirstListenerForProduct = listeners.size === 0;
    listeners.add(onAvailableChange);
    entry.listenersByProductId.set(productId, listeners);
    if (isFirstListenerForProduct) {
      entry.syncWatchedProductIds();
    }

    return function unwatchProduct() {
      const currentListeners = entry.listenersByProductId.get(productId);
      if (!currentListeners) {
        return;
      }
      currentListeners.delete(onAvailableChange);
      if (currentListeners.size === 0) {
        entry.listenersByProductId.delete(productId);
        entry.syncWatchedProductIds();
      }
    };
  }

  return {
    watchProduct,
    subscribeToReconnect: entry.stream.subscribeToReconnect,
  };
}

export { createStockWatchClient };
