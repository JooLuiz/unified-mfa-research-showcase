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
  publishLogoutRequested,
  publishRenderRequested,
  subscribeToAuthSessionChanges,
  subscribeToLogoutRequests,
  subscribeToRenderRequests,
} from "./events/eventBus";
import { mountNotificationCenter } from "./notifications/notificationCenter";
import { mountHeaderAndFooter } from "./utils/mountActions";
import { navigate } from "./utils/navigate";
import { publishNotification } from "./notifications/notificationAdapter";
import { MOCK_API_BASE_URL } from "./utils/constants";
import {
  startAdminOrderStatusStream,
  stopAdminOrderStatusStream,
} from "@shared/order-status-events";
import {
  startNotificationInboxLiveEvents,
  stopNotificationInboxLiveEvents,
  subscribeToNewInboxNotifications,
} from "@shared/notification-inbox-events";
import { subscribeToSessionRevoked } from "@shared/session-events";
import {
  startAdminLiveEvents,
  stopAdminLiveEvents,
} from "./events/adminLiveEvents";
import {
  renderLoginPage,
  renderDashboardPage,
  renderOrdersPage,
  renderOrderDetailsPage,
  renderPostsPage,
  renderAccountPage,
} from "./utils/renderActions";

const appState = {
  authToken: null,
  currentUser: null,
};

let currentRenderId = 0;
let activeCleanupFunctions = [];

subscribeToNewInboxNotifications((notification) => {
  publishNotification({
    type: "success",
    title: notification.title,
    message: notification.message,
    link: notification.link,
  });
});

/**
 * Starts or stops the admin live-notifications SSE stream to match the current session.
 *
 * @returns {void}
 * @sideEffects Opens or closes the SSE connection via src/events/adminLiveEvents.js.
 */
function syncAdminLiveEventsWithSession() {
  if (isAdminAuthenticated(appState)) {
    void startAdminLiveEvents(appState);
    void startAdminOrderStatusStream({
      apiBaseUrl: MOCK_API_BASE_URL,
      authToken: appState.authToken,
    });
    void startNotificationInboxLiveEvents({
      apiBaseUrl: MOCK_API_BASE_URL,
      authToken: appState.authToken,
      shell: "admin",
    });
  } else {
    stopAdminLiveEvents();
    stopAdminOrderStatusStream();
    stopNotificationInboxLiveEvents();
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
  mountHeaderAndFooter(appState, layoutMounts, modules, activeCleanupFunctions);

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

  if (pathName.startsWith("/order-details/")) {
    await renderOrderDetailsPage(appState, layoutMounts.pageMount, modules, activeCleanupFunctions);
    return;
  }

  if (pathName.startsWith("/posts/")) {
    const postId = pathName.slice("/posts/".length);
    if (modules.mountSinglePost) {
      const cleanupSinglePost = modules.mountSinglePost(layoutMounts.pageMount, {
        postId,
        apiBaseUrl: MOCK_API_BASE_URL,
        authToken: appState.authToken,
        currentUserId: appState.currentUser?.id,
        navigate,
        canLike: false,
      });
      if (typeof cleanupSinglePost === "function") {
        activeCleanupFunctions.push(cleanupSinglePost);
      }
    }
    return;
  }

  if (pathName === "/notifications") {
    if (modules.mountNotificationsPage) {
      const cleanupNotifications = modules.mountNotificationsPage(layoutMounts.pageMount, {
        navigate,
      });
      if (typeof cleanupNotifications === "function") {
        activeCleanupFunctions.push(cleanupNotifications);
      }
    }
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
