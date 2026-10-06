import "./styles.css";

import {
  readStoredAuth,
  clearAuthSession,
  isAdminAuthenticated,
  isAdminRoute,
  rememberPostLoginRedirect,
  refreshCurrentUserFromApi,
} from "./utils/authActions";

import loadRemoteModules from "./utils/loadRemoteModules";
import {
  publishRenderRequested,
  subscribeToAuthSessionChanges,
  subscribeToLogoutRequests,
  subscribeToRenderRequests,
} from "./events/eventBus";
import { mountNotificationCenter } from "./notifications/notificationCenter";
import { mountHeaderAndFooter } from "./utils/mountActions";
import { navigate } from "./utils/navigate";
import { publishNotification } from "./notifications/notificationAdapter";
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

const appState = {
  authToken: null,
  currentUser: null,
};

let currentRenderId = 0;
let activeCleanupFunctions = [];

/**
 * Starts or stops the admin live-notifications SSE stream to match the current session.
 *
 * @returns {void}
 * @sideEffects Opens or closes the SSE connection via src/events/adminLiveEvents.js.
 */
function syncAdminLiveEventsWithSession() {
  if (isAdminAuthenticated(appState)) {
    void startAdminLiveEvents(appState);
  } else {
    stopAdminLiveEvents();
  }
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

subscribeToRenderRequests(() => {
  renderApp();
});

window.addEventListener("popstate", () => {
  renderApp();
});

subscribeToAuthSessionChanges(() => {
  syncAdminLiveEventsWithSession();
  renderApp();
});

subscribeToLogoutRequests(() => {
  clearAuthSession(appState);
  navigate("/login");
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
    void refreshCurrentUserFromApi(appState);
  }
  syncAdminLiveEventsWithSession();
  await renderApp();
}

bootstrap().catch((error) => {
  const appRoot = document.getElementById("appRoot");
  appRoot.innerHTML = `<pre>Application bootstrap failed: ${error.message}</pre>`;
});
