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
  fetchMeshConnectionTicket,
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
import { publishNotification } from "./notifications/meshNotificationAdapter";
import {
  isLocalMeshStarted,
  isAuthenticatedMeshActive,
  setLocalMeshStarted,
  setAuthenticatedMeshActive,
  clearMeshSessionFlags,
} from "./notifications/meshSessionState";
import {
  renderLoginPage,
  renderDashboardPage,
  renderOrdersPage,
  renderPostsPage,
  renderAccountPage,
} from "./utils/renderActions";

const appState = {
  authToken: null,
  currentUser: null,
};

let currentRenderId = 0;
let activeCleanupFunctions = [];

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
        throw new Error("missing auth token for mesh ticket");
      }
      return fetchMeshConnectionTicket(authToken);
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
}

function startAuthenticatedMeshSession() {
  if (!appState.authToken) {
    return;
  }

  if (isAuthenticatedMeshActive()) {
    ensureNotificationDisplayListeners();
    return;
  }

  resetNotificationDisplayListeners();
  mesh.close();
  clearMeshSessionFlags();

  configureAuthenticatedApplicationMesh();
  setAuthenticatedMeshActive(true);
  ensureNotificationDisplayListeners();
}

function downgradeToLocalMeshSession() {
  resetNotificationDisplayListeners();
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
      rememberPostLoginRedirect(pathName + window.location.search);
      history.replaceState({}, "", "/login");
      window.dispatchEvent(new CustomEvent("global:renderApp"));
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
      window.dispatchEvent(new CustomEvent("global:renderApp"));
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
    await renderDashboardPage(appState, layoutMounts.pageMount);
    return;
  }

  if (pathName === "/orders") {
    await renderOrdersPage(appState, layoutMounts.pageMount);
    return;
  }

  if (pathName === "/posts") {
    await renderPostsPage(appState, layoutMounts.pageMount);
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

window.addEventListener("global:renderApp", () => {
  renderApp();
});

window.addEventListener("popstate", () => {
  renderApp();
});

window.addEventListener("auth:changed", () => {
  handleAuthMeshLifecycle();
  renderApp();
});

window.addEventListener("auth:logout-request", () => {
  clearAuthSession(appState);
  navigate("/login");
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
