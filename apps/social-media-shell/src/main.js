import "./styles.css";

import {
  registerApplication,
  start,
  unloadApplication,
  getAppStatus,
  MOUNTED,
} from "single-spa";

import {
  readStoredAuth,
  clearAuthSession,
  isAuthenticated,
  isProtectedRoute,
  rememberPostLoginRedirect,
  refreshCurrentUserFromApi,
  fetchMeshConnectionTicket,
} from "./utils/authActions";
import { AUTH_TOKEN_STORAGE_KEY, ECOMMERCE_SHELL_BASE_URL } from "./utils/constants";

import loadMockData from "./utils/loadData";
import loadRemoteModules from "./utils/loadRemoteModules";
import { navigate } from "./utils/navigate";
import { createHeaderApp, createFooterApp } from "./utils/mountActions";
import {
  mountNotificationCenter,
  ensureNotificationDisplayListeners,
  resetNotificationDisplayListeners,
} from "./notifications/notificationCenter";
import {
  isLocalMeshStarted,
  isAuthenticatedMeshActive,
  setLocalMeshStarted,
  setAuthenticatedMeshActive,
  clearMeshSessionFlags,
} from "./notifications/sessionState";
import { ensureCsvExportListeners, resetCsvExportListeners } from "./exports/requestCsvExport";
import {
  ensureAccountIntentListeners,
  ensureCatalogIntentListeners,
  ensureCommunityIntentListeners,
  ensureShellEventListeners,
  publishRenderRequested,
  resetAccountIntentListeners,
  resetCatalogIntentListeners,
  resetCommunityIntentListeners,
  resetShellEventListeners,
} from "./events/eventBus";
import {
  feedPageApp,
  postsPageApp,
  loginPageApp,
  accountPageApp,
} from "./utils/pageApps";
import { persistAccountUpdate } from "./commands/accountCommands";
import { persistNewPost } from "./commands/postCommands";
import { publishNotification } from "./notifications/notificationAdapter";
import { configureMesh } from "event-mesh/mesh";
import mesh from "event-mesh/mesh";

const appState = {
  posts: [],
  banners: [],
  products: [],
  productsById: {},
  showcases: [],
  authToken: null,
  currentUser: null,
};

const HEADER_APP_NAME = "@social-media/header";
const FOOTER_APP_NAME = "@social-media/footer";
const FEED_PAGE_APP_NAME = "@social-media/feed-page";
const POSTS_PAGE_APP_NAME = "@social-media/posts-page";
const LOGIN_PAGE_APP_NAME = "@social-media/login-page";
const ACCOUNT_PAGE_APP_NAME = "@social-media/account-page";

const PAGE_APP_NAMES = [
  FEED_PAGE_APP_NAME,
  POSTS_PAGE_APP_NAME,
  LOGIN_PAGE_APP_NAME,
  ACCOUNT_PAGE_APP_NAME,
];

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
    configureGuestApplicationMesh();
    setLocalMeshStarted(true);
  }

  ensureNotificationDisplayListeners();
  ensureShellEventListeners(shellEventHandlers);
  ensureCatalogIntentListeners(catalogIntentHandlers);
  ensureAccountIntentListeners(accountIntentHandlers);
  ensureCommunityIntentListeners(communityIntentHandlers);
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
    ensureAccountIntentListeners(accountIntentHandlers);
    ensureCommunityIntentListeners(communityIntentHandlers);
    return;
  }

  resetNotificationDisplayListeners();
  resetCsvExportListeners();
  resetShellEventListeners();
  resetCatalogIntentListeners();
  resetAccountIntentListeners();
  resetCommunityIntentListeners();
  mesh.close();
  clearMeshSessionFlags();

  configureAuthenticatedApplicationMesh();
  setAuthenticatedMeshActive(true);
  ensureNotificationDisplayListeners();
  ensureCsvExportListeners();
  ensureShellEventListeners(shellEventHandlers);
  ensureCatalogIntentListeners(catalogIntentHandlers);
  ensureAccountIntentListeners(accountIntentHandlers);
  ensureCommunityIntentListeners(communityIntentHandlers);
}

function downgradeToLocalMeshSession() {
  resetCsvExportListeners();
  resetNotificationDisplayListeners();
  resetShellEventListeners();
  resetCatalogIntentListeners();
  resetAccountIntentListeners();
  resetCommunityIntentListeners();
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

function activeOnExactPath(targetPath) {
  return function activeWhen(currentLocation) {
    return currentLocation.pathname === targetPath;
  };
}

function reloadMountedAppsByName(applicationNames) {
  applicationNames.forEach((applicationName) => {
    if (getAppStatus(applicationName) === MOUNTED) {
      void unloadApplication(applicationName);
    }
  });
}

function reloadActivePageApp() {
  reloadMountedAppsByName(PAGE_APP_NAMES);
}

function registerLayoutApplications() {
  registerApplication({
    name: HEADER_APP_NAME,
    app: () => Promise.resolve(createHeaderApp()),
    activeWhen: () => true,
    customProps: {
      appState,
      domElement: document.getElementById("headerMount"),
    },
  });

  registerApplication({
    name: FOOTER_APP_NAME,
    app: () => Promise.resolve(createFooterApp()),
    activeWhen: () => true,
    customProps: {
      appState,
      domElement: document.getElementById("footerMount"),
    },
  });
}

function registerPageApplications() {
  const pageMountElement = document.getElementById("pageMount");

  registerApplication({
    name: FEED_PAGE_APP_NAME,
    app: () => Promise.resolve(feedPageApp),
    activeWhen: activeOnExactPath("/"),
    customProps: { appState, domElement: pageMountElement },
  });

  registerApplication({
    name: POSTS_PAGE_APP_NAME,
    app: () => Promise.resolve(postsPageApp),
    activeWhen: activeOnExactPath("/posts"),
    customProps: { appState, domElement: pageMountElement },
  });

  registerApplication({
    name: LOGIN_PAGE_APP_NAME,
    app: () => Promise.resolve(loginPageApp),
    activeWhen: activeOnExactPath("/login"),
    customProps: { appState, domElement: pageMountElement },
  });

  registerApplication({
    name: ACCOUNT_PAGE_APP_NAME,
    app: () => Promise.resolve(accountPageApp),
    activeWhen: activeOnExactPath("/account"),
    customProps: { appState, domElement: pageMountElement },
  });
}

/**
 * Hard-redirects to the ecommerce product details page for a catalog product id.
 *
 * @param {string} productId - Catalog product identifier.
 * @returns {void}
 * @sideEffects Assigns window.location to the ecommerce PDP URL.
 */
function redirectToEcommerceProductDetails(productId) {
  window.location.assign(
    `${ECOMMERCE_SHELL_BASE_URL}/product?productId=${encodeURIComponent(productId)}`,
  );
}

/**
 * Builds an ecommerce PLP URL from promotion filter payload.
 *
 * @param {object} filters - PLP filter snapshot from mesh.
 * @returns {string} Absolute ecommerce /products URL with optional query.
 */
function buildEcommerceProductsUrlFromFilters(filters) {
  const queryParams = new URLSearchParams();
  if (filters?.searchQuery) {
    queryParams.set("searchQuery", filters.searchQuery);
  }
  if (filters?.minPrice) {
    queryParams.set("minPrice", filters.minPrice);
  }
  if (filters?.maxPrice) {
    queryParams.set("maxPrice", filters.maxPrice);
  }
  if (Array.isArray(filters?.categoryIds) && filters.categoryIds.length > 0) {
    queryParams.set("categoryIds", filters.categoryIds.join(","));
  }
  const querySuffix = queryParams.toString();
  return querySuffix
    ? `${ECOMMERCE_SHELL_BASE_URL}/products?${querySuffix}`
    : `${ECOMMERCE_SHELL_BASE_URL}/products`;
}

/**
 * Redirects to ecommerce PLP for a promotion-applied intent.
 *
 * @param {{ filters: object }} payload - Promotion mesh payload.
 * @returns {void}
 * @sideEffects Assigns window.location to the ecommerce products URL.
 */
function handlePromotionApplied({ filters }) {
  window.location.assign(buildEcommerceProductsUrlFromFilters(filters));
}

const catalogIntentHandlers = {
  onProductOpenRequested: ({ productId }) => {
    redirectToEcommerceProductDetails(productId);
  },
  onCartItemAddRequested: ({ productId }) => {
    redirectToEcommerceProductDetails(productId);
  },
  onPromotionApplied: handlePromotionApplied,
};

const accountIntentHandlers = {
  onProfileSaveRequested: (profilePayload) => {
    void persistAccountUpdate(appState, profilePayload);
  },
  onAddressSaveRequested: (addressPayload) => {
    void persistAccountUpdate(appState, { address: addressPayload });
  },
};

const communityIntentHandlers = {
  onPostLiked: ({ postId }) => {
    console.log("communityIntentHandlers - postId");
    console.log(postId);
  },
  onAuthorSelected: ({ author }) => {
    if (author?.username) {
      console.log("communityIntentHandlers - authorClicked");
      console.log(author);
    }
  },
  onPostSubmitted: (payload) => {
    if (!isAuthenticated(appState)) {
      return;
    }
    void persistNewPost(appState, {
      content: payload.content,
      imageUrl: payload.imageUrl,
      authorId: appState.currentUser?.id,
    }).then((postResult) => {
      if (postResult.ok) {
        publishNotification({
          type: "success",
          title: "Post published",
          message: "Your post is now visible in the community feed.",
        });
        publishRenderRequested();
      }
    });
  },
};

const shellEventHandlers = {
  onRenderRequested: () => {
    reloadActivePageApp();
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
    reloadActivePageApp();
  },
  onLogoutRequested: () => {
    clearAuthSession(appState);
    navigate("/");
  },
};

function applyInitialAuthGuard() {
  const currentPathName = window.location.pathname;
  if (isProtectedRoute(currentPathName) && !isAuthenticated(appState)) {
    const postLoginRedirectPath = currentPathName + window.location.search;
    history.replaceState({}, "", "/login");
    rememberPostLoginRedirect(postLoginRedirectPath);
  }
}

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
  await loadMockData(appState);
  if (appState.authToken) {
    void refreshCurrentUserFromApi(appState);
  }

  applyInitialAuthGuard();
  await loadRemoteModules;

  registerLayoutApplications();
  registerPageApplications();
  start();
}

bootstrap().catch((bootstrapError) => {
  const appRoot = document.getElementById("appRoot");
  appRoot.innerHTML = `<pre>Application bootstrap failed: ${bootstrapError.message}</pre>`;
});
