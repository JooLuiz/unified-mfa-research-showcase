import "./styles.css";

import { createAuthSessionLifecycle, createRenderedSessionMarker } from "@shared/shell-events";
import { readStoredPLPFilters, applyPlpFiltersFromLocation } from "./utils/PLPFilterActions";
import {
  readStoredAuth,
  clearAuthSession,
  refreshCurrentUserFromApi,
} from "./utils/authActions";

import loadRemoteModules from "./utils/loadRemoteModules";
import loadMockData from "./utils/loadData";
import {
  bindShellTransport,
  createShellSessionChannel,
  ensureAccountIntentListeners,
  ensureCatalogIntentListeners,
  ensureCheckoutIntentListeners,
  publishLogoutRequested,
  shellTransport,
  subscribeToAuthSessionChanges,
  subscribeToCartChanges,
  subscribeToLogoutRequests,
  subscribeToRenderRequests,
} from "./events/eventBus";
import { mountNotificationCenter } from "./notifications/notificationCenter";

import { updateHeaderState } from "./utils/mountActions";

import { startCartLiveEvents, stopCartLiveEvents } from "./events/cartLiveEvents";
import {
  startCustomerOrderStatusStream,
  stopCustomerOrderStatusStream,
} from "@shared/order-status-events";
import {
  startNotificationInboxLiveEvents,
  stopNotificationInboxLiveEvents,
  subscribeToNewInboxNotifications,
} from "@shared/notification-inbox-events";
import { subscribeToSessionRevoked } from "@shared/session-events";
import { publishNotification } from "./notifications/notificationAdapter";
import { startStockGating } from "./events/stockGating";
import { endCartSession, hydrateSavedCart, startCartTabSync } from "./utils/cartSync";
import { navigate } from "./utils/navigate";
import { createAccountIntentHandlers } from "./intents/accountIntentHandlers";
import { createCatalogIntentHandlers } from "./intents/catalogIntentHandlers";
import { createCheckoutIntentHandlers } from "./intents/checkoutIntentHandlers";
import { createPageRenderer } from "./pages/pageRenderer";

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

bindShellTransport(() => appState.authToken);

const renderedSession = createRenderedSessionMarker(appState);
const pageRenderer = createPageRenderer({
  appState,
  loadModules: () => loadRemoteModules,
  marker: renderedSession,
});

startStockGating(appState);

function setGlobalCartVariable() {
  window.__APP_SHELL_CART__ = appState.cartItems;
}

subscribeToCartChanges(() => {
  setGlobalCartVariable();
  updateHeaderState(appState, pageRenderer.getHeaderElement());
});

subscribeToRenderRequests(() => {
  pageRenderer.render();
});

window.addEventListener("popstate", () => {
  pageRenderer.render();
});

subscribeToNewInboxNotifications((notification) => {
  publishNotification({
    type: "success",
    title: notification.title,
    message: notification.message,
    link: notification.link,
    notificationId: notification.id,
  });
});

const catalogIntentHandlers = createCatalogIntentHandlers(appState);
const checkoutIntentHandlers = createCheckoutIntentHandlers(appState);
const accountIntentHandlers = createAccountIntentHandlers(appState);

const authSession = createAuthSessionLifecycle(createShellSessionChannel(), {
  isAuthenticated: () => Boolean(appState.authToken),
  // Window listeners last for the tab, so they are attached once and never detached.
  attachListeners: () => {
    ensureCatalogIntentListeners(catalogIntentHandlers);
    ensureCheckoutIntentListeners(checkoutIntentHandlers);
    ensureAccountIntentListeners(accountIntentHandlers);
  },
  startLiveEvents: () => {
    void startCartLiveEvents(shellTransport);
    void startCustomerOrderStatusStream(shellTransport);
    void startNotificationInboxLiveEvents(shellTransport, { shell: "ecommerce" });
  },
  stopLiveEvents: () => {
    stopCartLiveEvents();
    stopCustomerOrderStatusStream();
    stopNotificationInboxLiveEvents();
  },
});

subscribeToSessionRevoked(() => {
  if (!appState.authToken) {
    return;
  }
  publishNotification({
    type: "error",
    title: "Session ended",
    message: "Your session ended on another device.",
  });
  publishLogoutRequested();
});

subscribeToAuthSessionChanges(() => {
  // setAuthSession and refreshCurrentUserFromApi write appState before this event.
  // A matching user id is a profile refresh: remounting would replace the account
  // page's action buttons while a click is in flight.
  if (renderedSession.isSameSignedInUser()) {
    updateHeaderState(appState, pageRenderer.getHeaderElement());
    return;
  }
  authSession.sync();
  pageRenderer.render();
});

subscribeToLogoutRequests(() => {
  endCartSession(appState);
  clearAuthSession(appState);
  navigate("/");
});

async function bootstrap() {
  const notificationMount = document.getElementById("notificationMount");
  if (notificationMount) {
    mountNotificationCenter(notificationMount);
  }

  readStoredPLPFilters(appState);
  applyPlpFiltersFromLocation(appState);
  readStoredAuth(appState);
  await loadMockData(appState);
  startCartTabSync(appState);
  authSession.start();
  if (appState.authToken) {
    await hydrateSavedCart(appState);
    void refreshCurrentUserFromApi(appState);
  }
  setGlobalCartVariable();
  await pageRenderer.render();
}

bootstrap().catch((error) => {
  const appRoot = document.getElementById("appRoot");
  appRoot.innerHTML = `<pre>Application bootstrap failed: ${error.message}</pre>`;
});
