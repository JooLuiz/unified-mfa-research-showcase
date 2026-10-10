/**
 * Owns the one shared stock SSE connection for this browser tab.
 * Role: Opens GET /stock/stream once, tracks the server-issued streamId, reconnects with
 *   backoff, and keeps the server's watched-product-id set in sync with local listeners.
 * Not in this file: The public watch/unwatch API surface (src/createStockWatchClient.js) or
 *   guest session id management (src/guestStockSession.js).
 * Key dependencies: EventSource; fetch; src/guestStockSession.js; src/stockEventsContracts.js.
 * See also: apps/mock-data-service/src/routes/stockRoutes.js;
 *   apps/mock-data-service/src/infrastructure/stockEventStream.js.
 */

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

export { createStockWatchStream };
