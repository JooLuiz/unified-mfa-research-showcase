import "./styles.css";

import { createAuthSessionLifecycle, createRenderedSessionMarker } from "@shared/shell-events";
import { readStoredPLPFilters, applyPlpFiltersFromLocation } from "./utils/PLPFilterActions";
import {
  readStoredAuth,
  clearAuthSession,
  refreshCurrentUserFromApi,
  fetchStoredConnectionTicket,
} from "./utils/authActions";

import loadRemoteModules from "./utils/loadRemoteModules";
import loadMockData from "./utils/loadData";
import {
  mountNotificationCenter,
  ensureNotificationDisplayListeners,
  resetNotificationDisplayListeners,
} from "./notifications/notificationCenter";
import { publishNotification } from "./notifications/notificationAdapter";
import {
  bindShellTransport,
  createShellSessionChannel,
  ensureAccountIntentListeners,
  ensureCartEventListeners,
  ensureCatalogIntentListeners,
  ensureCheckoutIntentListeners,
  ensureShellEventListeners,
  publishLogoutRequested,
  publishPlpFiltersChanged,
  resetAccountIntentListeners,
  resetCartEventListeners,
  resetCatalogIntentListeners,
  resetCheckoutIntentListeners,
  resetShellEventListeners,
  shellTransport,
} from "./events/eventBus";

import { updateHeaderState } from "./utils/mountActions";

import { startCartLiveEvents, stopCartLiveEvents } from "./events/cartLiveEvents";
import {
  startCustomerOrderStatusStream,
  stopCustomerOrderStatusStream,
} from "@shared/order-status-events";
import {
  startSessionLiveEvents,
  stopSessionLiveEvents,
  subscribeToSessionRevoked,
} from "@shared/session-events";
import {
  startNotificationInboxLiveEvents,
  stopNotificationInboxLiveEvents,
  subscribeToNewInboxNotifications,
} from "@shared/notification-inbox-events";
import { startStockGating } from "./events/stockGating";
import { endCartSession, hydrateSavedCart, mergeGuestCartOnLogin, scheduleCartPersist, startCartTabSync } from "./utils/cartSync";
import { navigate } from "./utils/navigate";
import { placeCheckoutOrder } from "./commands/placeCheckoutOrder";
import { persistAccountUpdate } from "./commands/accountCommands";
import { createCatalogIntentHandlers } from "./intents/catalogIntentHandlers";
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

function setGlobalCartVariable() {
  window.__APP_SHELL_CART__ = appState.cartItems;
}

// The shared handlers own the stock checks, the toasts, and the empty-cart re-render.
const catalogIntentHandlers = createCatalogIntentHandlers(appState);

const checkoutIntentHandlers = {
  onCouponApplied: (coupon) => {
    appState.appliedCoupon = coupon;
    updateHeaderState(appState, pageRenderer.getHeaderElement());
    scheduleCartPersist(appState);
  },
  onPlaceOrderRequested: () => {
    void placeCheckoutOrder(shellTransport, appState);
  },
};

const accountIntentHandlers = {
  onProfileSaveRequested: (profilePayload) => {
    void persistAccountUpdate(shellTransport, appState, profilePayload);
  },
  onAddressSaveRequested: (addressPayload) => {
    void persistAccountUpdate(shellTransport, appState, { address: addressPayload });
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

const shellEventHandlers = {
  onCartChanged: () => {
    setGlobalCartVariable();
    updateHeaderState(appState, pageRenderer.getHeaderElement());
  },
  onRenderRequested: () => {
    void pageRenderer.render();
  },
  onPathRequested: ({ path }) => {
    navigate(path);
  },
  onAuthSessionChanged: () => {
    const wasAuthenticated = Boolean(appState.authToken);
    readStoredAuth(appState);
    const isNowAuthenticated = Boolean(appState.authToken);
    authSession.sync();
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
    // refreshCurrentUserFromApi republishes this event for the same user.
    // Remounting would replace the account page's action buttons mid-click.
    if (renderedSession.isSameSignedInUser()) {
      updateHeaderState(appState, pageRenderer.getHeaderElement());
      return;
    }
    void pageRenderer.render();
  },
  onLogoutRequested: () => {
    endCartSession(appState);
    clearAuthSession(appState);
    navigate("/");
  },
};

const authSession = createAuthSessionLifecycle(
  createShellSessionChannel({ getConnectionTicket: fetchStoredConnectionTicket }),
  {
    isAuthenticated: () => Boolean(appState.authToken),
    attachListeners: () => {
      ensureNotificationDisplayListeners();
      ensureShellEventListeners(shellEventHandlers);
      ensureCatalogIntentListeners(catalogIntentHandlers);
      ensureCheckoutIntentListeners(checkoutIntentHandlers);
      ensureAccountIntentListeners(accountIntentHandlers);
      ensureCartEventListeners(shellEventHandlers);
    },
    detachListeners: () => {
      resetNotificationDisplayListeners();
      resetShellEventListeners();
      resetCatalogIntentListeners();
      resetCheckoutIntentListeners();
      resetAccountIntentListeners();
      resetCartEventListeners();
    },
    startLiveEvents: () => {
      void startCartLiveEvents(shellTransport);
      void startCustomerOrderStatusStream(shellTransport);
      void startSessionLiveEvents(shellTransport);
      void startNotificationInboxLiveEvents(shellTransport, { shell: "ecommerce" });
    },
    stopLiveEvents: () => {
      stopCartLiveEvents();
      stopCustomerOrderStatusStream();
      stopSessionLiveEvents();
      stopNotificationInboxLiveEvents();
    },
    // Re-send this guest's in-memory cart line holds now that its mesh session is up. This
    // covers initial bootstrap and the post-logout downgrade; it does not cover an in-place
    // WebSocket reconnect on an already-guest tab, since event-mesh's public client API does not
    // expose a reconnect callback to hook into.
    onGuestReady: () => {
      startStockGating(appState);
    },
  },
);

window.addEventListener("popstate", () => {
  void pageRenderer.render();
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

subscribeToSessionRevoked(() => {
  if (!appState.authToken) {
    return;
  }
  // Logout first. Downgrade resets the toast listener and clears rendered toasts,
  // so the session-ended notice is published on the local mesh that downgrade opens.
  publishLogoutRequested();
  publishNotification({
    type: "error",
    title: "Session ended",
    message: "Your session ended on another device.",
  });
});

async function bootstrap() {
  readStoredPLPFilters(appState);
  readStoredAuth(appState);
  authSession.start();
  // The notification subscribe and promotional catalog publish have to follow
  // configureMesh. The first use initializes EventMesh and a later configureMesh throws.
  const notificationMount = document.getElementById("notificationMount");
  if (notificationMount) {
    mountNotificationCenter(notificationMount);
  }
  applyPlpFiltersFromLocation(appState);
  startCartTabSync(appState);
  publishPlpFiltersChanged(appState.plpFilters);
  await loadMockData(appState);
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
