import "./styles.css";

import {
  registerApplication,
  start,
  unloadApplication,
  getAppStatus,
  MOUNTED,
} from "single-spa";

import { createAuthSessionLifecycle, createRenderedSessionMarker } from "@shared/shell-events";
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
  bindShellTransport,
  createShellSessionChannel,
  ensureAccountIntentListeners,
  ensureCatalogIntentListeners,
  ensureCommunityIntentListeners,
  publishLogoutRequested,
  shellTransport,
  subscribeToAuthSessionChanges,
  subscribeToLogoutRequests,
  subscribeToRenderRequests,
} from "./events/eventBus";
import { navigate } from "./utils/navigate";
import { addPostIfMissing } from "./utils/postsState";
import { createHeaderApp, createFooterApp } from "./utils/mountActions";
import { mountNotificationCenter } from "./notifications/notificationCenter";
import { publishNotification } from "./notifications/notificationAdapter";
import { subscribeToPostLikesChanged, subscribeToPostCreated } from "@shared/post-like-events";
import {
  startNotificationInboxLiveEvents,
  stopNotificationInboxLiveEvents,
  subscribeToNewInboxNotifications,
} from "@shared/notification-inbox-events";
import { subscribeToSessionRevoked } from "@shared/session-events";
import * as pageApps from "./utils/pageApps";
import {
  FOOTER_APP_NAME,
  HEADER_APP_NAME,
  PAGE_APP_NAMES,
  createPageAppRegistrations,
} from "./pages/pageRegistry";
import { createAccountIntentHandlers } from "./intents/accountIntentHandlers";
import { createCatalogIntentHandlers } from "./intents/catalogIntentHandlers";
import { createCommunityIntentHandlers } from "./intents/communityIntentHandlers";

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

const renderedSession = createRenderedSessionMarker(appState);

function reloadActivePageApp() {
  PAGE_APP_NAMES.forEach((applicationName) => {
    if (getAppStatus(applicationName) === MOUNTED) {
      void unloadApplication(applicationName);
    }
  });
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
  createPageAppRegistrations(pageApps).forEach(({ name, app, activeWhen }) => {
    registerApplication({
      name,
      app: () => Promise.resolve(app),
      activeWhen,
      customProps: { appState, domElement: pageMountElement },
    });
  });
}

subscribeToRenderRequests(() => {
  reloadActivePageApp();
});

const catalogIntentHandlers = createCatalogIntentHandlers();
const communityIntentHandlers = createCommunityIntentHandlers(shellTransport, appState);
const accountIntentHandlers = createAccountIntentHandlers(appState);

const authSession = createAuthSessionLifecycle(createShellSessionChannel(), {
  isAuthenticated: () => Boolean(appState.authToken),
  // Window listeners last for the tab, so they are attached once and never detached.
  attachListeners: () => {
    ensureCatalogIntentListeners(catalogIntentHandlers);
    ensureCommunityIntentListeners(communityIntentHandlers);
    ensureAccountIntentListeners(accountIntentHandlers);
  },
  startLiveEvents: () => {
    void startNotificationInboxLiveEvents(shellTransport, { shell: "social" });
  },
  stopLiveEvents: stopNotificationInboxLiveEvents,
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

subscribeToAuthSessionChanges(() => {
  // setAuthSession and refreshCurrentUserFromApi write appState before this event.
  // A matching user id is a profile refresh. The header updates itself from this same
  // event, so reloading the page apps would only tear down buttons mid-click.
  if (renderedSession.isSameSignedInUser()) {
    return;
  }
  // Re-fetches posts so `likedByCurrentUser` reflects the session that is active now (a tab
  // that first loaded as a guest, or as a different user, must not keep a stale like flag).
  authSession.sync();
  loadMockData(appState)
    .catch((loadError) => {
      console.warn("subscribeToAuthSessionChanges - loadError");
      console.warn(loadError);
    })
    .finally(() => {
      reloadActivePageApp();
      renderedSession.remember();
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
  authSession.start();

  applyInitialAuthGuard();
  const modules = await loadRemoteModules;

  registerLayoutApplications(modules);
  registerPageApplications();
  start();
  renderedSession.remember();
}

bootstrap().catch((bootstrapError) => {
  const appRoot = document.getElementById("appRoot");
  appRoot.innerHTML = `<pre>Application bootstrap failed: ${bootstrapError.message}</pre>`;
});
