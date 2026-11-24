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
  fetchConnectionTicket,
} from "./utils/authActions";
import { AUTH_TOKEN_STORAGE_KEY, ECOMMERCE_SHELL_BASE_URL, MOCK_API_BASE_URL } from "./utils/constants";

import loadMockData from "./utils/loadData";
import loadRemoteModules from "./utils/loadRemoteModules";
import { navigate } from "./utils/navigate";
import { isSinglePostPath } from "./utils/singlePostRoute";
import { addPostIfMissing } from "./utils/postsState";
import { createHeaderApp, createFooterApp, updateHeaderState } from "./utils/mountActions";
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
import {
  bindShellTransport,
  closeShellMesh,
  configureShellMesh,
  ensureAccountIntentListeners,
  ensureCatalogIntentListeners,
  ensureCommunityIntentListeners,
  ensureShellEventListeners,
  publishLogoutRequested,
  publishRenderRequested,
  resetAccountIntentListeners,
  resetCatalogIntentListeners,
  resetCommunityIntentListeners,
  resetShellEventListeners,
  shellTransport,
  subscribeToAuthSessionChanges,
  subscribeToLogoutRequests,
  subscribeToRenderRequests,
} from "./events/eventBus";
import {
  subscribeToPostLikesChanged,
  subscribeToPostCreated,
} from "@shared/post-like-events";
import { toggleLikeForPost } from "./commands/postLikeCommands";
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
import {
  feedPageApp,
  postsPageApp,
  loginPageApp,
  accountPageApp,
  notificationsPageApp,
  singlePostPageApp,
} from "./utils/pageApps";
import { persistAccountUpdate } from "./commands/accountCommands";
import { persistNewPost } from "./commands/postCommands";
import { publishNotification } from "./notifications/notificationAdapter";

const appState = {
  posts: [],
  banners: [],
  products: [],
  productsById: {},
  showcases: [],
  authToken: null,
  currentUser: null,
};

bindShellTransport(() => appState.authToken);

const HEADER_APP_NAME = "@social-media/header";
const FOOTER_APP_NAME = "@social-media/footer";
const FEED_PAGE_APP_NAME = "@social-media/feed-page";
const POSTS_PAGE_APP_NAME = "@social-media/posts-page";
const LOGIN_PAGE_APP_NAME = "@social-media/login-page";
const ACCOUNT_PAGE_APP_NAME = "@social-media/account-page";
const NOTIFICATIONS_PAGE_APP_NAME = "@social-media/notifications-page";
const SINGLE_POST_PAGE_APP_NAME = "@social-media/single-post-page";

const PAGE_APP_NAMES = [
  FEED_PAGE_APP_NAME,
  POSTS_PAGE_APP_NAME,
  LOGIN_PAGE_APP_NAME,
  ACCOUNT_PAGE_APP_NAME,
  NOTIFICATIONS_PAGE_APP_NAME,
  SINGLE_POST_PAGE_APP_NAME,
];

function configureGuestApplicationMesh() {
  configureShellMesh({
    gatewayUrl: "ws://localhost",
    gatewayPort: 3004,
    enableWebSocket: true,
  });
}

function configureAuthenticatedApplicationMesh() {
  configureShellMesh({
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
    ensureShellEventListeners(shellEventHandlers);
    ensureCatalogIntentListeners(catalogIntentHandlers);
    ensureAccountIntentListeners(accountIntentHandlers);
    ensureCommunityIntentListeners(communityIntentHandlers);
    void startSessionLiveEvents(shellTransport);
    syncNotificationInboxWithSession();
    return;
  }

  resetNotificationDisplayListeners();
  resetShellEventListeners();
  resetCatalogIntentListeners();
  resetAccountIntentListeners();
  resetCommunityIntentListeners();
  stopSessionLiveEvents();
  stopNotificationInboxLiveEvents();
  closeShellMesh();
  clearMeshSessionFlags();

  configureAuthenticatedApplicationMesh();
  setAuthenticatedMeshActive(true);
  ensureNotificationDisplayListeners();
  ensureShellEventListeners(shellEventHandlers);
  ensureCatalogIntentListeners(catalogIntentHandlers);
  ensureAccountIntentListeners(accountIntentHandlers);
  ensureCommunityIntentListeners(communityIntentHandlers);
  void startSessionLiveEvents(shellTransport);
  syncNotificationInboxWithSession();
}

function downgradeToLocalMeshSession() {
  resetNotificationDisplayListeners();
  resetShellEventListeners();
  resetCatalogIntentListeners();
  resetAccountIntentListeners();
  resetCommunityIntentListeners();
  stopSessionLiveEvents();
  stopNotificationInboxLiveEvents();
  closeShellMesh();
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

function activeOnSinglePostPath() {
  return function activeWhen(currentLocation) {
    return isSinglePostPath(currentLocation.pathname);
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

let lastRenderedUserId = null;

/**
 * Records the user id that the current page apps were mounted for.
 *
 * @returns {void}
 * @sideEffects Updates lastRenderedUserId from appState.
 */
function rememberRenderedSession() {
  lastRenderedUserId = appState.authToken ? appState.currentUser?.id ?? null : null;
}

function registerLayoutApplications(modules) {
  registerApplication({
    name: HEADER_APP_NAME,
    app: () => Promise.resolve(createHeaderApp()),
    activeWhen: () => true,
    customProps: {
      appState,
      domElement: document.getElementById("headerMount"),
      modules,
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

  registerApplication({
    name: NOTIFICATIONS_PAGE_APP_NAME,
    app: () => Promise.resolve(notificationsPageApp),
    activeWhen: activeOnExactPath("/notifications"),
    customProps: { appState, domElement: pageMountElement },
  });

  registerApplication({
    name: SINGLE_POST_PAGE_APP_NAME,
    app: () => Promise.resolve(singlePostPageApp),
    activeWhen: activeOnSinglePostPath(),
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
    void persistAccountUpdate(shellTransport, appState, profilePayload);
  },
  onAddressSaveRequested: (addressPayload) => {
    void persistAccountUpdate(shellTransport, appState, { address: addressPayload });
  },
};

const communityIntentHandlers = {
  onPostLiked: ({ postId }) => {
    const likedPost = appState.posts.find((post) => post.id === postId);
    void toggleLikeForPost(shellTransport, appState, likedPost);
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
    void persistNewPost(shellTransport, appState, {
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

function syncNotificationInboxWithSession() {
  if (appState.authToken) {
    void startNotificationInboxLiveEvents(shellTransport, { shell: "social" });
  } else {
    stopNotificationInboxLiveEvents();
  }
}

subscribeToNewInboxNotifications((notification) => {
  publishNotification({
    type: "success",
    title: notification.title,
    message: notification.message,
    link: notification.link,
    notificationId: notification.id,
  });
});

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
    const signedInThisTurn = !wasAuthenticated && isNowAuthenticated;
    if (signedInThisTurn) {
      // The login form publishes path-requested immediately after this handler.
      // Closing the mesh here drops that navigation, so reconnect after this turn.
      const welcomeName =
        appState.currentUser?.fullName ||
        appState.currentUser?.username ||
        "there";
      queueMicrotask(() => {
        handleAuthMeshLifecycle();
        syncNotificationInboxWithSession();
        updateHeaderState(appState);
        // The lifecycle reset clears toasts already on the page, so this notice
        // is published on the authenticated mesh that lifecycle just opened.
        publishNotification({
          type: "success",
          title: "Signed in",
          message: `Welcome back, ${welcomeName}.`,
        });
      });
    } else {
      handleAuthMeshLifecycle();
      syncNotificationInboxWithSession();
      // mesh.close() drops the header subscription, including on sign-out.
      updateHeaderState(appState);
    }
    // Reloading would tear down a mounted page's action buttons mid-click.
    // mesh.close() drops the header's own auth subscription, so the shell pushes the name.
    if (appState.authToken && appState.currentUser?.id === lastRenderedUserId) {
      updateHeaderState(appState);
      return;
    }
    // Re-fetches posts so `likedByCurrentUser` reflects the session that is active now (a tab
    // that first loaded as a guest, or as a different user, must not keep a stale like flag).
    loadMockData(appState)
      .catch((loadError) => {
        console.warn("onAuthSessionChanged - loadError");
        console.warn(loadError);
      })
      .finally(() => {
        reloadActivePageApp();
        rememberRenderedSession();
      });
  },
  onLogoutRequested: () => {
    clearAuthSession(appState);
    navigate("/");
  },
};

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

/**
 * Registers this tab for one post's later like counts.
 *
 * @param {{ publish?: Function, whenConnected?: Function }} transport - Shell event interface.
 * @param {string | undefined} postId - Post that just arrived and is not rendered on every page.
 * @returns {void}
 * @sideEffects Publishes community-likes/watching. A subscribe-only transport is ignored.
 */
function publishCommunityLikeWatch(transport, postId) {
  if (typeof postId !== "string" || postId.trim() === "") {
    return;
  }
  if (typeof transport.publish !== "function" || typeof transport.whenConnected !== "function") {
    return;
  }
  transport
    .whenConnected({ timeoutMs: 5000 })
    .then(() => {
      transport.publish({
        topic: "community-likes",
        event: "watching",
        payload: { postId },
        scope: "distributed",
      });
    })
    .catch(() => {
      // This tab keeps the like count from the created post until the next announce.
    });
}

function applyInitialAuthGuard() {
  const currentPathName = window.location.pathname;
  if (isProtectedRoute(currentPathName) && !isAuthenticated(appState)) {
    const postLoginRedirectPath = currentPathName + window.location.search;
    history.replaceState({}, "", "/login");
    rememberPostLoginRedirect(postLoginRedirectPath);
  }
}

async function bootstrap() {
  readStoredAuth(appState);
  if (appState.authToken) {
    startAuthenticatedMeshSession();
  } else {
    startLocalMeshSession();
  }
  // These subscribes have to follow configureMesh. The first use initializes
  // EventMesh and a later configureMesh throws. They still run before any page mounts.
  const notificationMount = document.getElementById("notificationMount");
  if (notificationMount) {
    mountNotificationCenter(notificationMount);
  }
  // Global for the life of the tab (signed-in or guest), independent of which page is mounted:
  // keeps appState.posts correct for the next render. The author's "liked your post" toast comes
  subscribeToPostLikesChanged(shellTransport, ({ postId, likes, likerId, liked }) => {
    appState.posts = appState.posts.map((post) => {
      if (post.id !== postId) {
        return post;
      }
      const likedByCurrentUser =
        likerId === appState.currentUser?.id ? liked : post.likedByCurrentUser;
      return { ...post, likes, likedByCurrentUser };
    });
  });
  // The single place that inserts a newly created post into appState.posts. This subscription is
  // registered before any page can mount, so it always runs before a page-level subscriber to the
  // same push (feedPage.js, postsPage.js) — those only re-render from this already-updated array
  // instead of inserting again, which would duplicate the post. addPostIfMissing is required (not
  // a raw prepend) because the server broadcasts this push to every open tab including the post's
  // own author, whose tab may have already inserted it optimistically from the HTTP response in
  // src/commands/postCommands.js.
  subscribeToPostCreated(shellTransport, (newPost) => {
    addPostIfMissing(appState, { ...newPost, likedByCurrentUser: false });
    // A feed that has not rendered this post yet still needs its later like counts.
    publishCommunityLikeWatch(shellTransport, newPost && newPost.id);
  });
  await loadMockData(appState);
  if (appState.authToken) {
    void refreshCurrentUserFromApi(appState);
  }
  syncNotificationInboxWithSession();

  applyInitialAuthGuard();
  const modules = await loadRemoteModules;

  registerLayoutApplications(modules);
  registerPageApplications();
  start();
  rememberRenderedSession();
}

bootstrap().catch((bootstrapError) => {
  const appRoot = document.getElementById("appRoot");
  appRoot.innerHTML = `<pre>Application bootstrap failed: ${bootstrapError.message}</pre>`;
});
