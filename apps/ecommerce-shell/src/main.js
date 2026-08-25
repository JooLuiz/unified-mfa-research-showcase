import "./styles.css";

import { readStoredPLPFilters } from "./utils/PLPFilterActions";
import {
  readStoredAuth,
  clearAuthSession,
  isAuthenticated,
  isProtectedRoute,
  rememberPostLoginRedirect,
  refreshCurrentUserFromApi,
} from "./utils/authActions";
import { configureMesh } from "event-mesh/mesh";

import loadRemoteModules from "./utils/loadRemoteModules";
import loadMockData from "./utils/loadData";
import { mountNotificationCenter } from "./notifications/notificationCenter";
import { notify } from "./notifications/notificationBus";

import { mountHeaderAndFooter, updateHeaderState } from "./utils/mountActions";

import { navigate } from "./utils/navigate";
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

function configureApplicationMesh() {
  configureMesh({
    gatewayUrl: "ws://localhost",
    gatewayPort: 3004,
    enableWebSocket: true,
  });
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
      window.dispatchEvent(new CustomEvent("global:renderApp"));
      return;
    }
  }

  if (isProtectedRoute(pathName) && !isAuthenticated(appState)) {
    rememberPostLoginRedirect(pathName + window.location.search);
    history.replaceState({}, "", "/login");
    window.dispatchEvent(new CustomEvent("global:renderApp"));
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

window.addEventListener("cart:updateGlobalCart", () => {
  setGlobalCartVariable();
  updateHeaderState(appState, activeHeaderElement);
});

window.addEventListener("global:renderApp", () => {
  renderApp();
});

window.addEventListener("popstate", () => {
  renderApp();
});

window.addEventListener("auth:changed", () => {
  renderApp();
});

window.addEventListener("auth:logout-request", () => {
  clearAuthSession(appState);
  navigate("/");
});

window.addEventListener("cart:add-item", (event) => {
  const payload = event.detail;
  if (!payload || !payload.productId) {
    return;
  }

  const incomingQuantity = Number(payload.quantity);
  const quantityValue =
    Number.isFinite(incomingQuantity) && incomingQuantity > 0
      ? incomingQuantity
      : 1;
  const existingItem = appState.cartItems.find(
    (cartItem) => cartItem.productId === payload.productId,
  );
  if (existingItem) {
    existingItem.quantity += quantityValue;
  } else {
    appState.cartItems.push({
      productId: payload.productId,
      quantity: quantityValue,
    });
  }
  setGlobalCartVariable();
  updateHeaderState(appState, activeHeaderElement);
  const productName =
    appState.productsById[payload.productId]?.name || "Item";
  notify({
    type: "success",
    title: "Item added",
    message: `${productName} was added to your cart.`,
  });
});

async function bootstrap() {
  configureApplicationMesh();
  const notificationMount = document.getElementById("notificationMount");
  if (notificationMount) {
    mountNotificationCenter(notificationMount);
  }

  readStoredPLPFilters(appState);
  readStoredAuth(appState);
  await loadMockData(appState);
  setGlobalCartVariable();
  if (appState.authToken) {
    void refreshCurrentUserFromApi(appState);
  }
  await renderApp();
}

bootstrap().catch((error) => {
  const appRoot = document.getElementById("appRoot");
  appRoot.innerHTML = `<pre>Application bootstrap failed: ${error.message}</pre>`;
});
