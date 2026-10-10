import { onUnmounted, ref, watch } from "vue";
import { createStockWatchClient } from "@shared/stock-events";

/**
 * Vue composable that keeps a product's live "available" count current.
 * Role: Starts and stops watching the loaded product through the shared stock client as the
 *   product or API base url changes, and clamps a quantity ref when the count it holds drops
 *   below the selected quantity.
 * Not in this file: Rendering (src/product-card-component.js) or the stock transport
 *   (@shared/stock-events).
 * Key dependencies: @shared/stock-events.
 * See also: src/product-card-component.js.
 *
 * @param {{ productRef: import("vue").Ref<{ id: string, available?: number } | null>, getApiBaseUrl: () => string, quantityRef: import("vue").Ref<number> }} availabilityInput - The loaded product, the current API base url, and the selected quantity to clamp.
 * @returns {{ availableCount: import("vue").Ref<number | null> }} The live available count, or null before a count is known.
 */
export function useProductAvailability({ productRef, getApiBaseUrl, quantityRef }) {
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
    if (!product || !apiBaseUrl) {
      return;
    }
    const stockClient = createStockWatchClient({ apiBaseUrl });
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
