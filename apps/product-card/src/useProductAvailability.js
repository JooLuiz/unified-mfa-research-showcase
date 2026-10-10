import { onUnmounted, ref, watch } from "vue";
import mesh from "event-mesh/mesh";
import { createStockWatchClient } from "@shared/stock-events";

/**
 * Vue composable that keeps a product's live "available" count current.
 * Role: Starts and stops watching the loaded product through the shared stock client as the
 *   product changes, and clamps a quantity ref when the count it holds drops below the
 *   selected quantity.
 * Not in this file: Rendering (src/product-card-component.js) or the stock transport
 *   (@shared/stock-events).
 * Key dependencies: @shared/stock-events; event-mesh/mesh.
 * See also: src/product-card-component.js.
 *
 * @param {{ productRef: import("vue").Ref<{ id: string, available?: number } | null>, quantityRef: import("vue").Ref<number> }} availabilityInput - The loaded product and the selected quantity to clamp.
 * @returns {{ availableCount: import("vue").Ref<number | null> }} The live available count, or null before a count is known.
 */
export function useProductAvailability({ productRef, quantityRef }) {
  const availableCount = ref(null);
  const stockClient = createStockWatchClient({ mesh });
  let stopWatchingAvailability = null;

  function stopWatching() {
    if (stopWatchingAvailability) {
      stopWatchingAvailability();
      stopWatchingAvailability = null;
    }
  }

  function startWatching(product) {
    stopWatching();
    availableCount.value = typeof product?.available === "number" ? product.available : null;
    if (!product) {
      return;
    }
    stopWatchingAvailability = stockClient.watchProduct(product.id, (nextAvailable) => {
      availableCount.value = nextAvailable;
      if (nextAvailable > 0 && quantityRef.value > nextAvailable) {
        quantityRef.value = nextAvailable;
      }
    });
  }

  watch(() => productRef.value, startWatching, { immediate: true });

  onUnmounted(stopWatching);

  return { availableCount };
}
