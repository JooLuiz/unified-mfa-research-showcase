/**
 * Order loading composable for the order details MFE.
 * Role: Owns order-id parsing from the URL, auth token lookup, and the abort-aware order request lifecycle.
 * Not in this file: Rendering (src/OrderDetailsView.js) or formatting (src/order-details-utils.js).
 * Key dependencies: Mock data service GET /orders/:orderId; ecommerce-shell localStorage auth token.
 * See also: src/OrderDetailsView.js.
 */

import { onMounted, onUnmounted, ref, watch } from "vue";

const AUTH_TOKEN_STORAGE_KEY = "ecommerce-shell:auth-token";
const ORDER_DETAILS_ROUTE_PREFIX = "/order-details/";

function readAuthTokenFromLocalStorage() {
  try {
    const storedToken = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    return typeof storedToken === "string" ? storedToken : "";
  } catch {
    return "";
  }
}

function readOrderIdFromPathname() {
  const pathName = window.location.pathname || "";
  if (!pathName.startsWith(ORDER_DETAILS_ROUTE_PREFIX)) {
    return "";
  }

  const rawOrderIdSegment = pathName.slice(ORDER_DETAILS_ROUTE_PREFIX.length);
  if (!rawOrderIdSegment || rawOrderIdSegment.includes("/")) {
    return "";
  }

  try {
    return decodeURIComponent(rawOrderIdSegment);
  } catch {
    return "";
  }
}

async function fetchOrderById(apiBaseUrl, orderId, authToken, signal) {
  const requestHeaders = {};
  if (authToken) {
    requestHeaders.Authorization = `Bearer ${authToken}`;
  }
  const response = await fetch(`${apiBaseUrl}/orders/${orderId}`, {
    headers: requestHeaders,
    signal,
  });
  if (!response.ok) {
    throw new Error(
      `fetchOrderById - request failed: ${response.status} ${response.statusText}`,
    );
  }
  return response.json();
}

/**
 * Loads the order from props or the mock API and exposes the request state.
 *
 * @param {{ order: object | null, apiBaseUrl: string }} props - Component props.
 * @returns {{ orderData: import("vue").Ref<object | null>, isLoading: import("vue").Ref<boolean>, loadError: import("vue").Ref<Error | null>, isMissingOrderId: import("vue").Ref<boolean> }} Reactive order state.
 * @sideEffects Performs an HTTP request on mount and prop changes, aborted on unmount or reload.
 */
function useOrderDetails(props) {
  const orderData = ref(props.order || null);
  const isLoading = ref(false);
  const loadError = ref(null);
  const isMissingOrderId = ref(false);
  let activeAbortController = null;

  const loadOrder = async () => {
    if (props.order) {
      orderData.value = props.order;
      isLoading.value = false;
      loadError.value = null;
      isMissingOrderId.value = false;
      return;
    }

    if (!props.apiBaseUrl) {
      orderData.value = null;
      return;
    }

    const orderId = readOrderIdFromPathname();
    if (!orderId) {
      isMissingOrderId.value = true;
      orderData.value = null;
      isLoading.value = false;
      loadError.value = null;
      return;
    }

    if (activeAbortController) {
      activeAbortController.abort();
    }

    const abortController = new AbortController();
    activeAbortController = abortController;
    isLoading.value = true;
    loadError.value = null;
    isMissingOrderId.value = false;

    try {
      const authToken = readAuthTokenFromLocalStorage();
      const fetchedOrder = await fetchOrderById(
        props.apiBaseUrl,
        orderId,
        authToken,
        abortController.signal,
      );
      if (!abortController.signal.aborted) {
        orderData.value = fetchedOrder;
      }
    } catch (error) {
      if (error.name === "AbortError") {
        return;
      }
      console.warn("loadOrder - error");
      console.warn(error);
      loadError.value = error;
      orderData.value = null;
    } finally {
      if (activeAbortController === abortController) {
        activeAbortController = null;
      }
      if (!abortController.signal.aborted) {
        isLoading.value = false;
      }
    }
  };

  onMounted(loadOrder);
  onUnmounted(() => {
    if (activeAbortController) {
      activeAbortController.abort();
      activeAbortController = null;
    }
  });

  watch(
    () => [props.order, props.apiBaseUrl],
    () => {
      loadOrder();
    },
  );

  return { orderData, isLoading, loadError, isMissingOrderId };
}

export { useOrderDetails };
