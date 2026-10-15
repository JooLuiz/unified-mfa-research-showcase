/**
 * Order loading composable for the order details MFE.
 * Role: Owns order-id parsing from the URL, auth token lookup, and the abort-aware order request lifecycle.
 * Not in this file: Rendering (src/OrderDetailsView.js) or formatting (src/order-details-utils.js).
 * Key dependencies: Mock data service GET /orders/:orderId; the host authToken prop or the
 *   ecommerce-shell localStorage token; @shared/order-status-events for status writes and the live stream.
 * See also: src/OrderDetailsView.js.
 */

import { onMounted, onUnmounted, ref, watch } from "vue";
import {
  requestAdminOrderStatusChange,
  requestOrderCancellation,
  subscribeToAdminOrderStatusChanged,
  subscribeToOrderStatusChanged,
} from "@shared/order-status-events";

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

async function fetchOrderById(apiBaseUrl, orderId, authToken, signal, buildOrderRequestPath) {
  const requestHeaders = {};
  if (authToken) {
    requestHeaders.Authorization = `Bearer ${authToken}`;
  }
  const relativePath =
    typeof buildOrderRequestPath === "function"
      ? buildOrderRequestPath(orderId)
      : `/orders/${orderId}`;
  const response = await fetch(`${apiBaseUrl}${relativePath}`, {
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
 * @param {{ order: object | null, apiBaseUrl: string, actor?: string, authToken?: string, buildOrderRequestPath?: (orderId: string) => string, onStatusRejected?: (statusResult: { ok: false, code: string }) => void }} props - Component props. A non-empty authToken overrides the ecommerce localStorage token. onStatusRejected fires for any actor whose status write is rejected.
 * @returns {{ orderData: import("vue").Ref<object | null>, isLoading: import("vue").Ref<boolean>, loadError: import("vue").Ref<Error | null>, isMissingOrderId: import("vue").Ref<boolean>, actor: string, applyStatusAction: (nextStatus: string) => Promise<void> }} Reactive order state and the status action.
 * @sideEffects Performs an HTTP request on mount and prop changes, aborted on unmount or reload. Subscribes to the shared order-status stream for this actor.
 */
function useOrderDetails(props) {
  const orderData = ref(props.order || null);
  const isLoading = ref(false);
  const loadError = ref(null);
  const isMissingOrderId = ref(false);
  let activeAbortController = null;
  let unsubscribeFromStatus = null;

  const readAuthToken = () => {
    if (typeof props.authToken === "string" && props.authToken.trim() !== "") {
      return props.authToken;
    }
    return readAuthTokenFromLocalStorage();
  };

  const applyStatusAction = async (nextStatus) => {
    const currentOrder = orderData.value;
    const authToken = readAuthToken();
    if (!currentOrder?.id || !authToken || !props.apiBaseUrl) {
      return;
    }
    const statusResult =
      props.actor === "admin"
        ? await requestAdminOrderStatusChange({
            apiBaseUrl: props.apiBaseUrl,
            authToken,
            orderId: currentOrder.id,
            status: nextStatus,
          })
        : await requestOrderCancellation({
            apiBaseUrl: props.apiBaseUrl,
            authToken,
            orderId: currentOrder.id,
          });
    if (statusResult.ok) {
      orderData.value = statusResult.order;
      return;
    }
    console.warn("applyStatusAction - rejected");
    console.warn(statusResult);
    if (typeof props.onStatusRejected === "function") {
      props.onStatusRejected(statusResult);
    }
  };

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
      const authToken = readAuthToken();
      const fetchedOrder = await fetchOrderById(
        props.apiBaseUrl,
        orderId,
        authToken,
        abortController.signal,
        props.buildOrderRequestPath,
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

  onMounted(() => {
    loadOrder();
    const subscribeToStatus =
      props.actor === "admin"
        ? subscribeToAdminOrderStatusChanged
        : subscribeToOrderStatusChanged;
    unsubscribeFromStatus = subscribeToStatus(({ orderId, status }) => {
      if (!orderData.value || orderData.value.id !== orderId) {
        return;
      }
      orderData.value = { ...orderData.value, status };
    });
  });
  onUnmounted(() => {
    if (unsubscribeFromStatus) {
      unsubscribeFromStatus();
      unsubscribeFromStatus = null;
    }
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

  return {
    orderData,
    isLoading,
    loadError,
    isMissingOrderId,
    actor: props.actor === "admin" ? "admin" : "customer",
    applyStatusAction,
  };
}

export { useOrderDetails };
