import "./styles.css";

import { readStoredPLPFilters } from "./utils/PLPFilterActions";

import loadRemoteModules from "./utils/loadRemoteModules";
import loadMockData from "./utils/loadData";

import {
  calculatePlpItemsPerRow,
  getPlpInitialVisibleCount,
} from "./utils/PLPProductsActions";

import { mountHeaderAndFooter } from "./utils/mountActions";

import { navigate } from "./utils/navigate";
import {
  renderHomePage,
  renderPromotionsPage,
  renderProductListPage,
  renderProductDetailsPage,
  renderCheckoutPage,
  renderOrderPlacedPage,
} from "./utils/renderActions";

//INITIAL APP STATE
const appState = {
  products: [],
  productsById: {},
  categories: [],
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
  plpVisibleCount: 8,
  plpItemsPerRow: 4,
  appliedCoupon: null,
  lastIframeMessage: "",
  isFormularySubmitted: false,
};

//GLOBAL CONFIGURATIONS AND UTILITIES
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

  const layoutMounts = baseLayout();
  mountHeaderAndFooter(appState, layoutMounts);

  const pathName = window.location.pathname;
  if (pathName === "/") {
    await renderHomePage(
      appState,
      layoutMounts.pageMount,
      modules,
      activeCleanupFunctions,
    );
    return;
  }

  if (pathName === "/products") {
    await renderProductListPage(
      appState,
      layoutMounts.pageMount,
      modules,
      activeCleanupFunctions,
    );
    return;
  }

  if (pathName === "/promotions") {
    await renderPromotionsPage(
      appState,
      layoutMounts.pageMount,
      modules,
      activeCleanupFunctions,
    );
    return;
  }

  if (pathName === "/product") {
    await renderProductDetailsPage(
      appState,
      layoutMounts.pageMount,
      modules,
      activeCleanupFunctions,
    );
    return;
  }

  if (pathName === "/checkout") {
    await renderCheckoutPage(
      appState,
      layoutMounts.pageMount,
      modules,
      activeCleanupFunctions,
    );
    return;
  }

  if (pathName === "/order-placed") {
    await renderOrderPlacedPage(layoutMounts.pageMount, activeCleanupFunctions);
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

// EVENTS HANDLERS
window.addEventListener("cart:updateGlobalCart", () => {
  setGlobalCartVariable();
});

window.addEventListener("global:renderApp", () => {
  renderApp();
});

window.addEventListener("popstate", () => {
  renderApp();
});

window.addEventListener("resize", () => {
  if (window.location.pathname !== "/products") {
    return;
  }

  const recalculatedItemsPerRow = calculatePlpItemsPerRow();
  if (recalculatedItemsPerRow === appState.plpItemsPerRow) {
    return;
  }

  appState.plpItemsPerRow = recalculatedItemsPerRow;
  appState.plpVisibleCount = Math.max(
    appState.plpVisibleCount,
    getPlpInitialVisibleCount(recalculatedItemsPerRow),
  );
  renderApp();
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
    renderApp();
    return;
  }

  if (messageData.type === "order-placed:completed") {
    appState.lastIframeMessage = "Order placed flow completed via iframe.";
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

async function bootstrap() {
  readStoredPLPFilters(appState);
  await loadMockData(appState);
  setGlobalCartVariable();
  await renderApp();
}

bootstrap().catch((error) => {
  const appRoot = document.getElementById("appRoot");
  appRoot.innerHTML = `<pre>Application bootstrap failed: ${error.message}</pre>`;
});
