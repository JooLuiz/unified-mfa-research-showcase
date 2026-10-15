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
} from "./utils/authActions";

import loadMockData from "./utils/loadData";
import loadRemoteModules from "./utils/loadRemoteModules";
import {
  publishLogoutRequested,
  subscribeToAuthSessionChanges,
  subscribeToLogoutRequests,
  subscribeToRenderRequests,
} from "./events/eventBus";
import { navigate } from "./utils/navigate";
import { createHeaderApp, createFooterApp } from "./utils/mountActions";
import { mountNotificationCenter } from "./notifications/notificationCenter";
import { publishNotification } from "./notifications/notificationAdapter";
import { subscribeToPostLikesChanged } from "@shared/post-like-events";
import {
  startNotificationInboxLiveEvents,
  stopNotificationInboxLiveEvents,
  subscribeToNewInboxNotifications,
} from "@shared/notification-inbox-events";
import { subscribeToSessionRevoked } from "@shared/session-events";
import { MOCK_API_BASE_URL } from "./utils/constants";
import {
  feedPageApp,
  postsPageApp,
  loginPageApp,
  accountPageApp,
  notificationsPageApp,
  singlePostPageApp,
} from "./utils/pageApps";

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

function activeOnExactPath(targetPath) {
  return function activeWhen(currentLocation) {
    return currentLocation.pathname === targetPath;
  };
}

function activeOnSinglePostPath() {
  return function activeWhen(currentLocation) {
    return currentLocation.pathname.startsWith("/posts/") && currentLocation.pathname !== "/posts";
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

subscribeToRenderRequests(() => {
  reloadActivePageApp();
});

function syncNotificationInboxWithSession() {
  if (appState.authToken) {
    void startNotificationInboxLiveEvents({
      apiBaseUrl: MOCK_API_BASE_URL,
      authToken: appState.authToken,
      shell: "social",
    });
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
  });
});

subscribeToAuthSessionChanges(() => {
  // Re-fetches posts so `likedByCurrentUser` reflects the session that is active now (a tab
  // that first loaded as a guest, or as a different user, must not keep a stale like flag).
  syncNotificationInboxWithSession();
  loadMockData(appState)
    .catch((loadError) => {
      console.warn("subscribeToAuthSessionChanges - loadError");
      console.warn(loadError);
    })
    .finally(() => {
      reloadActivePageApp();
    });
});

subscribeToLogoutRequests(() => {
  clearAuthSession(appState);
  navigate("/");
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

// Global for the life of the tab (signed-in or guest), independent of which page is mounted:
// keeps appState.posts correct for the next render. The author's "liked your post" toast comes
// from the inbox stream (subscribeToNewInboxNotifications above). The liker's own "Post Liked"
// toast is fired separately, from the HTTP response in src/commands/postLikeCommands.js.
subscribeToPostLikesChanged(MOCK_API_BASE_URL, ({ postId, likes, likerId, liked }) => {
  appState.posts = appState.posts.map((post) => {
    if (post.id !== postId) {
      return post;
    }
    const likedByCurrentUser =
      likerId === appState.currentUser?.id ? liked : post.likedByCurrentUser;
    return { ...post, likes, likedByCurrentUser };
  });
});

function applyInitialAuthGuard() {
  const currentPathName = window.location.pathname;
  if (isProtectedRoute(currentPathName) && !isAuthenticated(appState)) {
    rememberPostLoginRedirect(currentPathName + window.location.search);
    history.replaceState({}, "", "/login");
  }
}

async function bootstrap() {
  const notificationMount = document.getElementById("notificationMount");
  if (notificationMount) {
    mountNotificationCenter(notificationMount);
  }

  readStoredAuth(appState);
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
}

bootstrap().catch((bootstrapError) => {
  const appRoot = document.getElementById("appRoot");
  appRoot.innerHTML = `<pre>Application bootstrap failed: ${bootstrapError.message}</pre>`;
});
