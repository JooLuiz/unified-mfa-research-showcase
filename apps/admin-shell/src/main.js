/**
 * Boots the admin shell, its page routing, and local integration services.
 * Role: Owns admin host lifecycle, authentication guards, mesh configuration, and page orchestration.
 * Not in this file: Remote MFE implementation, API request details, or toast rendering.
 * Key dependencies: event-mesh/mesh; notification and remote-module adapters.
 * See also: src/utils/loadRemoteModules.js; src/notifications/notificationCenter.js.
 */

import "./styles.css";
import { configureMesh } from "event-mesh/mesh";
import mesh from "event-mesh/mesh";

import {
  readStoredAuth,
  clearAuthSession,
  isAdminAuthenticated,
  isAdminRoute,
  rememberPostLoginRedirect,
  refreshCurrentUserFromApi,
  fetchConnectionTicket,
} from "./utils/authActions";
import { AUTH_TOKEN_STORAGE_KEY } from "./utils/constants";

import loadRemoteModules from "./utils/loadRemoteModules";
import {
  mountNotificationCenter,
  ensureNotificationDisplayListeners,
  resetNotificationDisplayListeners,
} from "./notifications/notificationCenter";
import { mountHeaderAndFooter } from "./utils/mountActions";
import { navigate } from "./utils/navigate";
import { publishNotification } from "./notifications/notificationAdapter";
import {
  isLocalMeshStarted,
  isAuthenticatedMeshActive,
  setLocalMeshStarted,
  setAuthenticatedMeshActive,
  clearMeshSessionFlags,
} from "./notifications/sessionState";
import {
  ensureAccountIntentListeners,
  ensureShellEventListeners,
  publishRenderRequested,
  resetAccountIntentListeners,
  resetShellEventListeners,
} from "./events/eventBus";
import {
  startAdminLiveEvents,
  stopAdminLiveEvents,
  subscribeToAdminLiveEvents,
} from "./events/adminLiveEvents";
import { ORDER_CREATED_EVENT_TYPE } from "./events/adminLiveEventsContracts";
import {
  renderLoginPage,
  renderDashboardPage,
  renderOrdersPage,
  renderPostsPage,
  renderAccountPage,
} from "./utils/renderActions";
import { persistAccountUpdate } from "./commands/accountCommands";

const appState = {
  authToken: null,
  currentUser: null,
};

let currentRenderId = 0;
let activeCleanupFunctions = [];

/**
 * Starts admin live-event subscriptions when the current user is an admin, and stops them otherwise.
 *
 * @returns {void}
 * @sideEffects Subscribes or unsubscribes the admin activity mesh listeners.
 */
function syncAdminLiveEventsWithSession() {
  if (isAdminAuthenticated(appState)) {
    void startAdminLiveEvents(appState);
  } else {
    stopAdminLiveEvents();
  }
}

/**
 * Configures local-only mesh for anonymous notification delivery.
 *
 * @returns {void}
 * @sideEffects Configures the mesh client without opening a WebSocket connection.
 */
function configureLocalApplicationMesh() {
  configureMesh({
    gatewayUrl: "ws://localhost",
    gatewayPort: 3004,
    enableWebSocket: false,
  });
}

/**
 * Configures authenticated mesh with gateway WebSocket and ticket acquisition.
 *
 * @returns {void}
 * @sideEffects Configures the browser WebSocket client for the local mesh gateway.
 */
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

function startLocalMeshSession() {
  if (isAuthenticatedMeshActive()) {
    return;
  }

  if (!isLocalMeshStarted()) {
    configureLocalApplicationMesh();
    setLocalMeshStarted(true);
  }

  ensureNotificationDisplayListeners();
  ensureShellEventListeners(shellEventHandlers);
  ensureAccountIntentListeners(accountIntentHandlers);
}

function startAuthenticatedMeshSession() {
  if (!appState.authToken) {
    return;
  }

  if (isAuthenticatedMeshActive()) {
    ensureNotificationDisplayListeners();
    ensureShellEventListeners(shellEventHandlers);
    ensureAccountIntentListeners(accountIntentHandlers);
    syncAdminLiveEventsWithSession();
    return;
  }

  resetNotificationDisplayListeners();
  resetShellEventListeners();
  resetAccountIntentListeners();
  mesh.close();
  clearMeshSessionFlags();

  configureAuthenticatedApplicationMesh();
  setAuthenticatedMeshActive(true);
  ensureNotificationDisplayListeners();
  ensureShellEventListeners(shellEventHandlers);
  ensureAccountIntentListeners(accountIntentHandlers);
  syncAdminLiveEventsWithSession();
}

function downgradeToLocalMeshSession() {
  stopAdminLiveEvents();
  resetNotificationDisplayListeners();
  resetShellEventListeners();
  resetAccountIntentListeners();
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

  if (isAdminRoute(pathName)) {
    if (!appState.authToken || !appState.currentUser) {
      const postLoginRedirectPath = pathName + window.location.search;
      history.replaceState({}, "", "/login");
      rememberPostLoginRedirect(postLoginRedirectPath);
      publishRenderRequested();
      return;
    }
    if (!isAdminAuthenticated(appState)) {
      clearAuthSession(appState);
      publishNotification({
        type: "error",
        title: "Access denied",
        message: "This account does not have admin access.",
      });
      history.replaceState({}, "", "/login");
      publishRenderRequested();
      return;
    }
  }

  const layoutMounts = baseLayout();
  mountHeaderAndFooter(appState, layoutMounts);

  if (pathName === "/login") {
    await renderLoginPage(appState, layoutMounts.pageMount, modules, activeCleanupFunctions);
    return;
  }

  if (pathName === "/") {
    await renderDashboardPage(appState, layoutMounts.pageMount, activeCleanupFunctions);
    return;
  }

  if (pathName === "/orders") {
    await renderOrdersPage(appState, layoutMounts.pageMount, activeCleanupFunctions);
    return;
  }

  if (pathName === "/posts") {
    await renderPostsPage(appState, layoutMounts.pageMount, activeCleanupFunctions);
    return;
  }

  if (pathName === "/account") {
    await renderAccountPage(
      appState,
      layoutMounts.pageMount,
      activeCleanupFunctions,
    );
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

const accountIntentHandlers = {
  onProfileSaveRequested: (profilePayload) => {
    void persistAccountUpdate(appState, profilePayload);
  },
  onAddressSaveRequested: (addressPayload) => {
    void persistAccountUpdate(appState, { address: addressPayload });
  },
};

const shellEventHandlers = {
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
    clearAuthSession(appState);
    navigate("/login");
  },
};

window.addEventListener("popstate", () => {
  void renderApp();
});

subscribeToAdminLiveEvents(({ type }) => {
  const isOrderEvent = type === ORDER_CREATED_EVENT_TYPE;
  publishNotification({
    type: "success",
    title: isOrderEvent ? "New order" : "New post",
    message: isOrderEvent ? "A new order was placed" : "A new post was made",
  });
});

async function bootstrap() {
  const notificationMount = document.getElementById("notificationMount");
  if (notificationMount) {
    mountNotificationCenter(notificationMount);
  }

  readStoredAuth(appState);
  if (appState.authToken) {
    startAuthenticatedMeshSession();
  } else {
    startLocalMeshSession();
  }
  if (appState.authToken) {
    void refreshCurrentUserFromApi(appState);
  }
  await renderApp();
}

bootstrap().catch((error) => {
  const appRoot = document.getElementById("appRoot");
  appRoot.innerHTML = `<pre>Application bootstrap failed: ${error.message}</pre>`;
});
