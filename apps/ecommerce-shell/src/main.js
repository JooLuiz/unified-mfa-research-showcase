import "./styles.css";

import { readStoredPLPFilters, storePLPFilters, normalizePlpFilters } from "./utils/PLPFilterActions";
import {
  readStoredAuth,
  clearAuthSession,
  isAuthenticated,
  isProtectedRoute,
  rememberPostLoginRedirect,
  refreshCurrentUserFromApi,
  fetchConnectionTicket,
} from "./utils/authActions";
import { AUTH_TOKEN_STORAGE_KEY } from "./utils/constants";
import { configureMesh } from "event-mesh/mesh";
import mesh from "event-mesh/mesh";

import loadRemoteModules from "./utils/loadRemoteModules";
import loadMockData from "./utils/loadData";
import {
  mountNotificationCenter,
  ensureNotificationDisplayListeners,
  resetNotificationDisplayListeners,
} from "./notifications/notificationCenter";
import { publishNotification } from "./notifications/notificationAdapter";
import {
  isLocalMeshStarted,
  isAuthenticatedMeshActive,
  setLocalMeshStarted,
  setAuthenticatedMeshActive,
  clearMeshSessionFlags,
} from "./notifications/sessionState";
import { ensureCsvExportListeners, resetCsvExportListeners } from "./exports/requestCsvExport";
import { resetCartSaveListeners } from "./commands/cartCommands";
import {
  ensureAccountIntentListeners,
  ensureCartEventListeners,
  ensureCatalogIntentListeners,
  ensureCheckoutIntentListeners,
  ensureShellEventListeners,
  publishPlpFiltersChanged,
  publishRenderRequested,
  resetAccountIntentListeners,
  resetCartEventListeners,
  resetCatalogIntentListeners,
  resetCheckoutIntentListeners,
  resetShellEventListeners,
} from "./events/eventBus";

import { mountHeaderAndFooter, updateHeaderState } from "./utils/mountActions";

import { startCartLiveEvents, stopCartLiveEvents } from "./events/cartLiveEvents";
import { startStockGating } from "./events/stockGating";
import { endCartSession, hydrateSavedCart, mergeGuestCartOnLogin, scheduleCartPersist, startCartTabSync } from "./utils/cartSync";
import { navigate } from "./utils/navigate";
import {
  addCartItemWithStockCheck,
  setCartItemQuantityWithStockCheck,
  STOCK_ISSUE_NOTIFICATION_MESSAGE,
} from "./utils/cartActions";
import { applyPromotionFilters } from "./pages/promotionsPage";
import { placeCheckoutOrder } from "./commands/placeCheckoutOrder";
import { persistAccountUpdate } from "./commands/accountCommands";
import {
  renderHomePage,
  renderPromotionsPage,
  renderProductListPage,
  renderProductDetailsPage,
  renderCheckoutPage,
  renderOrderPlacedPage,
  renderLoginPage,
  renderAccountPage,
  renderOrderDetailsPage,
} from "./utils/renderActions";

const appState = {
  products: [],
  productsById: {},
  showcases: [],
  banners: [],
  cartItems: [],
  plpFilters: {
    searchQuery: "",
    minPrice: "",
    maxPrice: "",
    categoryIds: [],
  },
  plpSortBy: "",
  appliedCoupon: null,
  lastIframeMessage: "",
  isFormularySubmitted: false,
  authToken: null,
  currentUser: null,
};

let currentRenderId = 0;
let activeCleanupFunctions = [];
let activeHeaderElement = null;
const ORDER_DETAILS_ROUTE_PREFIX = "/order-details/";

function configureGuestApplicationMesh() {
  configureMesh({
    gatewayUrl: "ws://localhost",
    gatewayPort: 3004,
    enableWebSocket: true,
  });
}

function configureAuthenticatedApplicationMesh() {
  configureMesh({
    gatewayUrl: "ws://localhost",
    gatewayPort: 3004,
    enableWebSocket: true,
    getConnectionTicket: async () => {
      const authToken = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
      if (!authToken) {
        throw new Error("missing auth token for connection ticket");
      }
      return fetchConnectionTicket(authToken);
    },
  });
}

function syncCartLiveEventsWithSession() {
  if (appState.authToken) {
    void startCartLiveEvents(appState);
  } else {
    stopCartLiveEvents();
  }
}

function startLocalMeshSession() {
  if (isAuthenticatedMeshActive()) {
    return;
  }

  if (!isLocalMeshStarted()) {
    configureGuestApplicationMesh();
    setLocalMeshStarted(true);
  }

  ensureNotificationDisplayListeners();
  ensureShellEventListeners(shellEventHandlers);
  ensureCatalogIntentListeners(catalogIntentHandlers);
  ensureCheckoutIntentListeners(checkoutIntentHandlers);
  ensureAccountIntentListeners(accountIntentHandlers);
  ensureCartEventListeners(shellEventHandlers);
  // Re-send this guest's in-memory cart line holds now that its mesh session is up. This
  // covers initial bootstrap and the post-logout downgrade; it does not cover an in-place
  // WebSocket reconnect on an already-guest tab, since event-mesh's public client API does not
  // expose a reconnect callback to hook into.
  startStockGating(appState);
}

function startAuthenticatedMeshSession() {
  if (!appState.authToken) {
    return;
  }

  if (isAuthenticatedMeshActive()) {
    ensureNotificationDisplayListeners();
    ensureCsvExportListeners();
    ensureShellEventListeners(shellEventHandlers);
    ensureCatalogIntentListeners(catalogIntentHandlers);
    ensureCheckoutIntentListeners(checkoutIntentHandlers);
    ensureAccountIntentListeners(accountIntentHandlers);
    ensureCartEventListeners(shellEventHandlers);
    syncCartLiveEventsWithSession();
    return;
  }

  resetNotificationDisplayListeners();
  resetCsvExportListeners();
  resetShellEventListeners();
  resetCatalogIntentListeners();
  resetCheckoutIntentListeners();
  resetAccountIntentListeners();
  resetCartEventListeners();
  resetCartSaveListeners();
  stopCartLiveEvents();
  mesh.close();
  clearMeshSessionFlags();

  configureAuthenticatedApplicationMesh();
  setAuthenticatedMeshActive(true);
  ensureNotificationDisplayListeners();
  ensureCsvExportListeners();
  ensureShellEventListeners(shellEventHandlers);
  ensureCatalogIntentListeners(catalogIntentHandlers);
  ensureCheckoutIntentListeners(checkoutIntentHandlers);
  ensureAccountIntentListeners(accountIntentHandlers);
  ensureCartEventListeners(shellEventHandlers);
  syncCartLiveEventsWithSession();
}

function downgradeToLocalMeshSession() {
  resetCsvExportListeners();
  resetNotificationDisplayListeners();
  resetShellEventListeners();
  resetCatalogIntentListeners();
  resetCheckoutIntentListeners();
  resetAccountIntentListeners();
  resetCartEventListeners();
  resetCartSaveListeners();
  stopCartLiveEvents();
  mesh.close();
  clearMeshSessionFlags();
  startLocalMeshSession();
}

function handleAuthMeshLifecycle() {
  if (appState.authToken) {
    startAuthenticatedMeshSession();
    return;
  }

  downgradeToLocalMeshSession();
}

function setGlobalCartVariable() {
  window.__APP_SHELL_CART__ = appState.cartItems;
}

function clearCurrentPage() {
  activeCleanupFunctions.forEach((cleanup) => {
    if (typeof cleanup === "function") {
      cleanup();
    }
  });
  activeCleanupFunctions = [];
  activeHeaderElement = null;
}

function baseLayout() {
  const appRoot = document.getElementById("appRoot");
  appRoot.innerHTML = `
    <div class="app-shell">
      <div id="headerMount"></div>
      <main id="pageMount" class="page-content"></main>
      <div id="footerMount"></div>
    </div>
  `;

  return {
    headerMount: appRoot.querySelector("#headerMount"),
    pageMount: appRoot.querySelector("#pageMount"),
    footerMount: appRoot.querySelector("#footerMount"),
  };
}

function isOrderDetailsPath(pathName) {
  if (!pathName.startsWith(ORDER_DETAILS_ROUTE_PREFIX)) {
    return false;
  }
  const orderIdSegment = pathName.slice(ORDER_DETAILS_ROUTE_PREFIX.length);
  return Boolean(orderIdSegment) && !orderIdSegment.includes("/");
}

async function renderApp() {
  const renderId = ++currentRenderId;
  clearCurrentPage();

  let modules;
  try {
    modules = await loadRemoteModules;
  } catch (error) {
    const appRoot = document.getElementById("appRoot");
    appRoot.innerHTML = `<pre>Unable to load remotes: ${error.message}</pre>`;
    return;
  }

  if (renderId !== currentRenderId) {
    return;
  }

  const pathName = window.location.pathname;
  const currentUrl = new URL(window.location.href);

  if (pathName === "/order-details") {
    const legacyOrderId = currentUrl.searchParams.get("orderId");
    if (legacyOrderId) {
      const encodedOrderId = encodeURIComponent(legacyOrderId);
      history.replaceState({}, "", `/order-details/${encodedOrderId}`);
      publishRenderRequested();
      return;
    }
  }

  if (isProtectedRoute(pathName) && !isAuthenticated(appState)) {
    const postLoginRedirectPath = pathName + window.location.search;
    history.replaceState({}, "", "/login");
    rememberPostLoginRedirect(postLoginRedirectPath);
    publishRenderRequested();
    return;
  }

  const layoutMounts = baseLayout();
  activeHeaderElement = mountHeaderAndFooter(appState, layoutMounts);

  if (pathName === "/") {
    await renderHomePage(appState, layoutMounts.pageMount, modules, activeCleanupFunctions);
    return;
  }

  if (pathName === "/products") {
    await renderProductListPage(appState, layoutMounts.pageMount, modules, activeCleanupFunctions);
    return;
  }

  if (pathName === "/promotions") {
    await renderPromotionsPage(appState, layoutMounts.pageMount, modules, activeCleanupFunctions);
    return;
  }

  if (pathName === "/product") {
    await renderProductDetailsPage(appState, layoutMounts.pageMount, modules, activeCleanupFunctions);
    return;
  }

  if (pathName === "/checkout") {
    await renderCheckoutPage(appState, layoutMounts.pageMount, modules, activeCleanupFunctions);
    return;
  }

  if (pathName === "/order-placed") {
    await renderOrderPlacedPage(layoutMounts.pageMount);
    return;
  }

  if (pathName === "/login") {
    await renderLoginPage(appState, layoutMounts.pageMount, modules, activeCleanupFunctions);
    return;
  }

  if (pathName === "/account") {
    await renderAccountPage(appState, layoutMounts.pageMount, activeCleanupFunctions);
    return;
  }

  if (isOrderDetailsPath(pathName)) {
    await renderOrderDetailsPage(appState, layoutMounts.pageMount, modules, activeCleanupFunctions);
    return;
  }

  layoutMounts.pageMount.innerHTML = `
    <section class="notice-box">
      <h2>Page not found</h2>
      <button id="goHomeButton">Go Home</button>
    </section>
  `;
  layoutMounts.pageMount
    .querySelector("#goHomeButton")
    .addEventListener("click", () => navigate("/"));
}

function handleCartChanged() {
  setGlobalCartVariable();
  updateHeaderState(appState, activeHeaderElement);
}

/**
 * Adds a catalog product-card's requested quantity to the cart from a catalog add-to-cart
 * intent, holding stock for it first.
 *
 * @param {{ productId: string, quantity: number }} cartItem - Validated add-to-cart payload.
 * @returns {void}
 * @sideEffects Reserves stock over the mesh, mutates cart, and toasts success or rejection.
 */
function handleCartItemAddRequested(cartItem) {
  void addCartItemWithStockCheck(appState, cartItem.productId, cartItem.quantity).then(
    (reservationResult) => {
      if (!reservationResult.ok) {
        publishNotification({
          type: "error",
          title: "Stock issue",
          message: STOCK_ISSUE_NOTIFICATION_MESSAGE,
        });
        return;
      }
      const productName =
        appState.productsById[cartItem.productId]?.name || "Item";
      publishNotification({
        type: "success",
        title: "Item added",
        message: `${productName} was added to your cart.`,
      });
    },
  );
}

/**
 * Opens product details for a catalog product-open intent.
 *
 * @param {{ productId: string }} payload - Validated product-open mesh payload.
 * @returns {void}
 * @sideEffects Navigates to the PDP route with a productId query param.
 */
function handleProductOpenRequested({ productId }) {
  navigate(`/product?productId=${encodeURIComponent(productId)}`);
}

/**
 * Persists PLP filters from a filters-apply intent without navigating.
 *
 * @param {object} filters - Normalized PLP filter snapshot from mesh.
 * @returns {void}
 * @sideEffects Updates appState and localStorage (+ filters-changed publish).
 */
function handleFiltersApplyRequested(filters) {
  appState.plpFilters = normalizePlpFilters(filters);
  storePLPFilters(appState);
}

/**
 * Applies promotion filters and navigates to the product list.
 *
 * @param {{ filters: object }} payload - Promotion-applied mesh payload.
 * @returns {void}
 * @sideEffects Persists PLP filters and navigates to /products.
 */
function handlePromotionApplied({ filters }) {
  applyPromotionFilters(appState, filters);
}

/**
 * Updates a cart line's quantity from a checkout items intent, holding the matching stock first.
 *
 * @param {{ productId: string, quantity: number }} cartItem - Validated update payload.
 * @returns {void}
 * @sideEffects Reserves stock over the mesh; mutates cart and publishes cart.changed only on
 *   success, otherwise toasts a stock-issue notification and leaves the cart unchanged.
 */
function handleCartItemUpdateRequested(cartItem) {
  void setCartItemQuantityWithStockCheck(appState, cartItem.productId, cartItem.quantity).then(
    (stockCheckResult) => {
      if (stockCheckResult.ok) {
        return;
      }
      publishNotification({
        type: "error",
        title: "Stock issue",
        message: STOCK_ISSUE_NOTIFICATION_MESSAGE,
      });
    },
  );
}

/**
 * Removes a cart line from a checkout items intent by releasing its stock hold first.
 *
 * @param {{ productId: string }} payload - Validated remove payload.
 * @returns {void}
 * @sideEffects Releases the stock hold over the mesh; mutates cart and toasts success, or toasts
 *   a stock-issue notification and leaves the cart unchanged on failure.
 */
function handleCartItemRemoveRequested({ productId }) {
  const productName = appState.productsById[productId]?.name || "Item";
  void setCartItemQuantityWithStockCheck(appState, productId, 0).then((stockCheckResult) => {
    if (!stockCheckResult.ok) {
      publishNotification({
        type: "error",
        title: "Stock issue",
        message: STOCK_ISSUE_NOTIFICATION_MESSAGE,
      });
      return;
    }
    publishNotification({
      type: "success",
      title: "Item removed",
      message: `${productName} was removed from your cart.`,
    });
    if (appState.cartItems.length === 0) {
      publishRenderRequested();
    }
  });
}

/**
 * Stores an applied coupon from the apply-coupon remote and refreshes the header total.
 *
 * @param {{ code: string, discountPercentage: number }} coupon - Validated coupon payload.
 * @returns {void}
 * @sideEffects Updates the mounted header element's discounted total.
 */
function handleCouponApplied(coupon) {
  appState.appliedCoupon = coupon;
  updateHeaderState(appState, activeHeaderElement);
  scheduleCartPersist(appState);
}

/**
 * Places the current order from the checkout-summary remote.
 *
 * @returns {void}
 * @sideEffects Starts the place-order command asynchronously.
 */
function handlePlaceOrderRequested() {
  void placeCheckoutOrder(appState);
}

const catalogIntentHandlers = {
  onProductOpenRequested: handleProductOpenRequested,
  onCartItemAddRequested: handleCartItemAddRequested,
  onFiltersApplyRequested: handleFiltersApplyRequested,
  onPromotionApplied: handlePromotionApplied,
  onCartItemUpdateRequested: handleCartItemUpdateRequested,
  onCartItemRemoveRequested: handleCartItemRemoveRequested,
};

const checkoutIntentHandlers = {
  onCouponApplied: handleCouponApplied,
  onPlaceOrderRequested: handlePlaceOrderRequested,
};

const accountIntentHandlers = {
  onProfileSaveRequested: (profilePayload) => {
    void persistAccountUpdate(appState, profilePayload);
  },
  onAddressSaveRequested: (addressPayload) => {
    void persistAccountUpdate(appState, { address: addressPayload });
  },
};

const shellEventHandlers = {
  onCartChanged: handleCartChanged,
  onRenderRequested: () => {
    void renderApp();
  },
  onPathRequested: ({ path }) => {
    navigate(path);
  },
  onAuthSessionChanged: () => {
    const wasAuthenticated = Boolean(appState.authToken);
    readStoredAuth(appState);
    const isNowAuthenticated = Boolean(appState.authToken);
    handleAuthMeshLifecycle();
    if (!wasAuthenticated && isNowAuthenticated) {
      void mergeGuestCartAfterLogin();
      const welcomeName =
        appState.currentUser?.fullName ||
        appState.currentUser?.username ||
        "there";
      publishNotification({
        type: "success",
        title: "Signed in",
        message: `Welcome back, ${welcomeName}.`,
      });
    }
    void renderApp();
  },
  onLogoutRequested: () => {
    endCartSession(appState);
    clearAuthSession(appState);
    navigate("/");
  },
};

async function mergeGuestCartAfterLogin() {
  const mergeResult = await mergeGuestCartOnLogin(
    appState,
    appState.authToken,
    appState.currentUser?.id || null,
  );
  if (mergeResult.needsPersist) {
    scheduleCartPersist(appState);
  }
}

window.addEventListener("popstate", () => {
  void renderApp();
});

async function bootstrap() {
  const notificationMount = document.getElementById("notificationMount");
  if (notificationMount) {
    mountNotificationCenter(notificationMount);
  }

  readStoredPLPFilters(appState);
  readStoredAuth(appState);
  startCartTabSync(appState);
  if (appState.authToken) {
    startAuthenticatedMeshSession();
  } else {
    startLocalMeshSession();
  }
  publishPlpFiltersChanged(appState.plpFilters);
  await loadMockData(appState);
  if (appState.authToken) {
    await hydrateSavedCart(appState);
    void refreshCurrentUserFromApi(appState);
  }
  setGlobalCartVariable();
  await renderApp();
}

bootstrap().catch((error) => {
  const appRoot = document.getElementById("appRoot");
  appRoot.innerHTML = `<pre>Application bootstrap failed: ${error.message}</pre>`;
});
