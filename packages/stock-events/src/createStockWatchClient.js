/**
 * Public per-tab stock watch client.
 * Role: Opens one stock EventSource per API base URL and lets mounted components register interest in a product's live availability.
 * Not in this file: Guest session id creation (src/guestStockSession.js) or reservation HTTP commands.
 * Key dependencies: src/createStockWatchEvents.js; src/stockEventsContracts.js; EventSource; fetch.
 * See also: apps/product-card/src/product-card-component.js;
 *   apps/product-details-page/src/product-details.component.ts;
 *   apps/checkout/src/checkout-items.ts; apps/ecommerce-shell/src/main.js;
 *   apps/mock-data-service/src/routes/stockRoutes.js.
 */

import { createStockWatchEvents } from "./createStockWatchEvents.js";
import { getOrCreateGuestStockSessionId } from "./guestStockSession.js";
import {
  STOCK_CHANGED_EVENT_NAME,
  STOCK_STREAM_READY_EVENT_NAME,
  STOCK_STREAM_PATH,
  STOCK_WATCHING_PATH,
} from "./stockEventsContracts.js";

const INITIAL_RECONNECT_DELAY_MS = 2000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const WATCH_SYNC_DEBOUNCE_MS = 150;

/**
 * Creates the one persistent stock stream for a given API base url. Opens eagerly and
 * reconnects on its own for the life of the tab; callers never close it directly.
 *
 * @param {{ apiBaseUrl: string }} streamInput - Mock API base URL.
 * @returns {{
 *   setWatchedProductIds: (productIds: string[]) => void,
 *   subscribeToStockChanged: (listener: (productId: string, available: number) => void) => () => void,
 *   subscribeToReconnect: (listener: () => void) => () => void,
 * }} Stream controls.
 */
function createStockWatchStream({ apiBaseUrl }) {
  let activeEventSource = null;
  let currentStreamId = null;
  let hasConnectedBefore = false;
  let reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
  let reconnectTimeoutId = null;
  let watchSyncTimeoutId = null;
  let currentWatchedProductIds = [];

  const stockChangedListeners = new Set();
  const reconnectListeners = new Set();

  function clearReconnectTimer() {
    if (reconnectTimeoutId) {
      window.clearTimeout(reconnectTimeoutId);
      reconnectTimeoutId = null;
    }
  }

  function sendWatchedProductIds() {
    if (!currentStreamId) {
      return;
    }
    fetch(`${apiBaseUrl}${STOCK_WATCHING_PATH}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ streamId: currentStreamId, productIds: currentWatchedProductIds }),
    }).catch((error) => {
      console.warn("sendWatchedProductIds - error");
      console.warn(error);
    });
  }

  function scheduleWatchSync() {
    if (watchSyncTimeoutId) {
      window.clearTimeout(watchSyncTimeoutId);
    }
    watchSyncTimeoutId = window.setTimeout(sendWatchedProductIds, WATCH_SYNC_DEBOUNCE_MS);
  }

  function handleStreamReady(messageEvent) {
    const { streamId } = JSON.parse(messageEvent.data);
    currentStreamId = streamId;
    reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
    sendWatchedProductIds();
    if (hasConnectedBefore) {
      reconnectListeners.forEach((listener) => listener());
    }
    hasConnectedBefore = true;
  }

  function handleStockChanged(messageEvent) {
    const { productId, available } = JSON.parse(messageEvent.data);
    stockChangedListeners.forEach((listener) => listener(productId, available));
  }

  function scheduleReconnect() {
    clearReconnectTimer();
    reconnectTimeoutId = window.setTimeout(() => {
      reconnectDelayMs = Math.min(reconnectDelayMs * 2, MAX_RECONNECT_DELAY_MS);
      openStream();
    }, reconnectDelayMs);
  }

  function openStream() {
    clearReconnectTimer();
    if (activeEventSource) {
      activeEventSource.close();
    }
    currentStreamId = null;
    const guestSessionId = getOrCreateGuestStockSessionId();
    activeEventSource = new EventSource(
      `${apiBaseUrl}${STOCK_STREAM_PATH}?sessionId=${encodeURIComponent(guestSessionId)}`,
    );
    activeEventSource.addEventListener(STOCK_STREAM_READY_EVENT_NAME, handleStreamReady);
    activeEventSource.addEventListener(STOCK_CHANGED_EVENT_NAME, handleStockChanged);
    activeEventSource.onerror = () => {
      if (activeEventSource) {
        activeEventSource.close();
        activeEventSource = null;
      }
      currentStreamId = null;
      scheduleReconnect();
    };
  }

  /**
   * Replaces the set of product ids this tab cares about and syncs it to the server.
   *
   * @param {string[]} productIds - Every product id any mounted watcher wants live updates for.
   * @returns {void}
   * @sideEffects Debounces a PUT /stock/watching call.
   */
  function setWatchedProductIds(productIds) {
    currentWatchedProductIds = Array.from(new Set(productIds));
    scheduleWatchSync();
  }

  /**
   * Subscribes to every stock_changed push, regardless of which product it names.
   *
   * @param {(productId: string, available: number) => void} listener - Called for every push.
   * @returns {() => void} Unsubscribe function.
   */
  function subscribeToStockChanged(listener) {
    stockChangedListeners.add(listener);
    return function unsubscribeFromStockChanged() {
      stockChangedListeners.delete(listener);
    };
  }

  /**
   * Subscribes to real reconnects only (not the stream's first connect).
   *
   * @param {() => void} listener - Called after the stream re-establishes following a drop.
   * @returns {() => void} Unsubscribe function.
   */
  function subscribeToReconnect(listener) {
    reconnectListeners.add(listener);
    return function unsubscribeFromReconnect() {
      reconnectListeners.delete(listener);
    };
  }

  openStream();

  return { setWatchedProductIds, subscribeToStockChanged, subscribeToReconnect };
}

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
