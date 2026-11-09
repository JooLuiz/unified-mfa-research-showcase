/**
 * Public per-product stock watch client.
 * Role: Lets any mounted component register interest in a product's live availability over
 *   Event Mesh, announcing stock/watching immediately and on a repeating interval while at
 *   least one listener cares, and fanning stock/changed out through createStockWatchEvents.
 * Not in this file: Reservation request/reply (src/stockReservationCommands.js) or mesh
 *   configuration (owned by the host shell).
 * Key dependencies: An Event Mesh client supplied by the caller; src/createStockWatchEvents.js.
 * See also: apps/product-card/src/useProductAvailability.js;
 *   apps/product-details-page/src/product-availability-watcher.ts;
 *   apps/checkout/src/checkout-availability-watcher.ts.
 */

import { createStockWatchEvents } from "./createStockWatchEvents.js";
import { STOCK_TOPIC, STOCK_WATCHING_EVENT } from "./stockEventsContracts.js";

const WATCHING_ANNOUNCE_INTERVAL_MS = 10_000;
const MESH_CONNECT_TIMEOUT_MS = 5000;

/**
 * Creates a stock watch client bound to one Event Mesh client.
 *
 * @param {{ mesh: { publish: (input: object) => void, subscribe: (topic: string, event: string, callback: (message: object) => void) => () => void, whenConnected: (input: { timeoutMs: number }) => Promise<void> } }} clientInput - Configured mesh client for the owning shell or remote.
 * @returns {{ watchProduct: (productId: string, onAvailableChange: (available: number) => void) => () => void }} The watch client.
 */
function createStockWatchClient({ mesh }) {
  const stockWatchEvents = createStockWatchEvents(mesh);
  /** @type {Map<string, number>} */
  const watchIntervalIdsByProductId = new Map();
  /** @type {Map<string, number>} */
  const watcherCountByProductId = new Map();

  function publishWatchingAnnounce(productId) {
    // Awaits the connection instead of requiring the caller to sequence watchProduct after
    // mesh session start: a product card can mount before the shell finishes configuring the
    // mesh session, and the next 10s interval tick retries if this attempt is dropped.
    mesh
      .whenConnected({ timeoutMs: MESH_CONNECT_TIMEOUT_MS })
      .then(() => {
        mesh.publish({
          topic: STOCK_TOPIC,
          event: STOCK_WATCHING_EVENT,
          payload: { productId },
          scope: "distributed",
        });
      })
      .catch(() => {
        // Not connected within the timeout; the next interval tick retries.
      });
  }

  /**
   * Registers interest in one product's live availability.
   *
   * @param {string} productId - Catalog product id.
   * @param {(available: number) => void} onAvailableChange - Called with every pushed count.
   * @returns {() => void} Unwatch function; call it on unmount or when the product id changes.
   * @sideEffects Publishes stock/watching immediately and every 10s while this is the first
   *   listener for that product. createStockWatchEvents subscribes to stock/changed per watcher.
   */
  function watchProduct(productId, onAvailableChange) {
    const currentCount = watcherCountByProductId.get(productId) || 0;
    watcherCountByProductId.set(productId, currentCount + 1);
    if (currentCount === 0) {
      publishWatchingAnnounce(productId);
      const intervalId = window.setInterval(
        () => publishWatchingAnnounce(productId),
        WATCHING_ANNOUNCE_INTERVAL_MS,
      );
      watchIntervalIdsByProductId.set(productId, intervalId);
    }
    const unwatchEvents = stockWatchEvents.watchProduct(productId, onAvailableChange);

    return function unwatchProduct() {
      unwatchEvents();
      const nextCount = (watcherCountByProductId.get(productId) || 1) - 1;
      if (nextCount <= 0) {
        watcherCountByProductId.delete(productId);
        const intervalId = watchIntervalIdsByProductId.get(productId);
        if (intervalId) {
          window.clearInterval(intervalId);
          watchIntervalIdsByProductId.delete(productId);
        }
        return;
      }
      watcherCountByProductId.set(productId, nextCount);
    };
  }

  return { watchProduct };
}

export { createStockWatchClient };
