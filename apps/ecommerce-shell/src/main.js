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

import loadRemoteModules from "./utils/loadRemoteModules";
import loadMockData from "./utils/loadData";
import fetchJson from "./utils/fetchJson";
import { MOCK_API_BASE_URL } from "./utils/constants";

import { mountHeaderAndFooter } from "./utils/mountActions";

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

  if (isProtectedRoute(pathName) && !isAuthenticated(appState)) {
    rememberPostLoginRedirect(pathName + window.location.search);
    history.replaceState({}, "", "/login");
    window.dispatchEvent(new CustomEvent("global:renderApp"));
    return;
  }

  const layoutMounts = baseLayout();
  mountHeaderAndFooter(appState, layoutMounts);

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

  if (pathName === "/order-details") {
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

window.addEventListener("message", (event) => {
  const messageData = event.data;
  if (!messageData || typeof messageData !== "object") {
    return;
  }

  if (messageData.type === "iframe:resize") {
    const frameId = messageData.payload?.frameId;
    const rawHeight = Number(messageData.payload?.height);
    if (typeof frameId === "string" && Number.isFinite(rawHeight)) {
      const frameElement = document.querySelector(
        `iframe[data-frame-id="${frameId}"]`,
      );
      if (frameElement) {
        frameElement.style.height = `${Math.max(rawHeight, 80)}px`;
      }
    }
    return;
  }

  if (messageData.type === "faq:form-submitted") {
    appState.isFormularySubmitted = true;
    appState.lastIframeMessage = `FAQ submitted by ${messageData.payload.name} (${messageData.payload.email})`;
    void persistFaqAnswerToApi(appState, messageData.payload);
    renderApp();
    return;
  }

  if (messageData.type === "checkout:go-shopping") {
    navigate("/products");
  }
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
  renderApp();
});

async function persistFaqAnswerToApi(appState, faqPayload) {
  try {
    await fetchJson(`${MOCK_API_BASE_URL}/faq`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(appState.authToken
          ? { Authorization: `Bearer ${appState.authToken}` }
          : {}),
      },
      body: JSON.stringify(faqPayload),
    });
  } catch (error) {
    console.warn("persistFaqAnswerToApi - error");
    console.warn(error);
  }
}

async function bootstrap() {
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
