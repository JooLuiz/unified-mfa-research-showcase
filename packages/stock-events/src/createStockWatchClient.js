/**
 * Public per-tab stock watch client.
 * Role: Shares one stock subscription for the page and publishes the watched product set after the stream is ready.
 * Not in this file: Guest session id creation (src/guestStockSession.js) or reservation commands.
 * Key dependencies: src/createStockWatchEvents.js; src/stockEventsContracts.js. The caller supplies the transport.
 * See also: apps/product-card/src/useProductAvailability.js; apps/ecommerce-shell/src/events/stockGating.js.
 */

import { createStockWatchEvents } from "./createStockWatchEvents.js";
import { STOCK_TOPIC } from "./stockEventsContracts.js";

const STOCK_READY_EVENT = "ready";
const STOCK_WATCHING_EVENT = "watching";
const WATCH_SYNC_DEBOUNCE_MS = 150;

/** @type {{ transport: object, stockWatchEvents: ReturnType<typeof createStockWatchEvents>, watcherCountByProductId: Map<string, number>, subscribeToReconnect: (listener: () => void) => () => void } | null} */
let sharedWatch = null;

/**
 * Returns the page's stock watch client. The first caller opens the stream and keeps it open.
 *
 * @param {{ subscribe: Function, publish: Function }} transport - Shell or MFE event interface.
 * @returns {{ watchProduct: (productId: string, onAvailableChange: (available: number) => void) => () => void, subscribeToReconnect: (listener: () => void) => () => void }} The watch client.
 * @sideEffects Subscribes to stock/changed and stock/ready, and publishes stock/watching.
 */
function createStockWatchClient(transport) {
  if (!sharedWatch) {
    sharedWatch = openSharedWatch(transport);
  }

  /**
   * Registers interest in one product's live availability.
   *
   * @param {string} productId - Catalog product id.
   * @param {(available: number) => void} onAvailableChange - Called with every pushed count.
   * @returns {() => void} Unwatch function.
   * @sideEffects Publishes the watched id set when this is the first or last listener for that product.
   */
  function watchProduct(productId, onAvailableChange) {
    const currentCount = sharedWatch.watcherCountByProductId.get(productId) || 0;
    sharedWatch.watcherCountByProductId.set(productId, currentCount + 1);
    if (currentCount === 0) {
      sharedWatch.syncWatchedProductIds();
    }
    const unwatchEvents = sharedWatch.stockWatchEvents.watchProduct(productId, onAvailableChange);

    return function unwatchProduct() {
      unwatchEvents();
      const nextCount = (sharedWatch.watcherCountByProductId.get(productId) || 1) - 1;
      if (nextCount <= 0) {
        sharedWatch.watcherCountByProductId.delete(productId);
        sharedWatch.syncWatchedProductIds();
        return;
      }
      sharedWatch.watcherCountByProductId.set(productId, nextCount);
    };
  }

  return {
    watchProduct,
    subscribeToReconnect: sharedWatch.subscribeToReconnect,
  };
}

/**
 * Opens the tab-lifetime stock subscription once.
 *
 * @param {{ subscribe: Function, publish: Function }} transport
 * @returns {{ stockWatchEvents: ReturnType<typeof createStockWatchEvents>, watcherCountByProductId: Map<string, number>, subscribeToReconnect: (listener: () => void) => () => void, syncWatchedProductIds: () => void }}
 * @sideEffects Subscribes immediately so a guest hold survives navigation between product pages.
 */
function openSharedWatch(transport) {
  let streamId = "";
  let hasConnectedBefore = false;
  let watchSyncTimeoutId = null;
  /** @type {Set<() => void>} */
  const reconnectListeners = new Set();
  /** @type {Map<string, number>} */
  const watcherCountByProductId = new Map();

  function publishWatchedProductIds() {
    if (!streamId) {
      return;
    }
    transport.publish({
      topic: STOCK_TOPIC,
      event: STOCK_WATCHING_EVENT,
      payload: {
        streamId,
        productIds: Array.from(watcherCountByProductId.keys()),
      },
      scope: "distributed",
    });
  }

  function syncWatchedProductIds() {
    if (watchSyncTimeoutId) {
      window.clearTimeout(watchSyncTimeoutId);
    }
    watchSyncTimeoutId = window.setTimeout(publishWatchedProductIds, WATCH_SYNC_DEBOUNCE_MS);
  }

  const stockWatchEvents = createStockWatchEvents({
    subscribe: transport.subscribe.bind(transport),
  });

  transport.subscribe(STOCK_TOPIC, STOCK_READY_EVENT, (message) => {
    streamId = message.payload?.streamId || "";
    publishWatchedProductIds();
    if (hasConnectedBefore) {
      reconnectListeners.forEach((listener) => listener());
    }
    hasConnectedBefore = true;
  });

  function subscribeToReconnect(listener) {
    reconnectListeners.add(listener);
    return function unsubscribeFromReconnect() {
      reconnectListeners.delete(listener);
    };
  }

  return { stockWatchEvents, watcherCountByProductId, subscribeToReconnect, syncWatchedProductIds };
}

export { createStockWatchClient };
