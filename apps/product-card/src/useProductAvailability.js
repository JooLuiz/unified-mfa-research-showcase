/**
 * Live availability for one product card.
 * Role: Binds the product-card stock adapter and watches the loaded product through the shared stock client.
 * Not in this file: Rendering (src/product-card-component.js).
 * Key dependencies: @shared/stock-events. The caller supplies the transport.
 * See also: src/product-card-component.js.
 */

import { onUnmounted, ref, watch } from "vue";
import { createStockWatchClient } from "@shared/stock-events";

/**
 * Starts and stops watching the loaded product, and clamps the selected quantity when availability drops.
 *
 * @param {{ productRef: import("vue").Ref<{ id: string, available?: number } | null>, getApiBaseUrl: () => string, quantityRef: import("vue").Ref<number>, transport?: { subscribe: Function, publish: Function } }} availabilityInput - The loaded product, the current API base url, the selected quantity to clamp, and the event interface.
 * @returns {{ availableCount: import("vue").Ref<number | null> }} The live available count, or null before a count is known.
 * @sideEffects Subscribes to the shared stock client while the composable is mounted and a transport is available.
 */
export function useProductAvailability({ productRef, getApiBaseUrl, quantityRef, transport }) {
  const availableCount = ref(null);
  let stopWatchingAvailability = null;

  function stopWatching() {
    if (stopWatchingAvailability) {
      stopWatchingAvailability();
      stopWatchingAvailability = null;
    }
  }

  function startWatching(product, apiBaseUrl) {
    stopWatching();
    availableCount.value = typeof product?.available === "number" ? product.available : null;
    if (!product || !apiBaseUrl || !transport) {
      return;
    }
    const stockClient = createStockWatchClient(transport);
    stopWatchingAvailability = stockClient.watchProduct(product.id, (nextAvailable) => {
      availableCount.value = nextAvailable;
      if (nextAvailable > 0 && quantityRef.value > nextAvailable) {
        quantityRef.value = nextAvailable;
      }
    });
  }

  watch(
    () => [productRef.value, getApiBaseUrl()],
    () => startWatching(productRef.value, getApiBaseUrl()),
    { immediate: true },
  );

  onUnmounted(stopWatching);

  return { availableCount };
}
