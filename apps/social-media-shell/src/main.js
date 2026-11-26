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
  fetchStoredConnectionTicket,
} from "./utils/authActions";

import loadMockData from "./utils/loadData";
import loadRemoteModules from "./utils/loadRemoteModules";
import { navigate } from "./utils/navigate";
import { addPostIfMissing } from "./utils/postsState";
import { createHeaderApp, createFooterApp, updateHeaderState } from "./utils/mountActions";
import {
  mountNotificationCenter,
  ensureNotificationDisplayListeners,
  resetNotificationDisplayListeners,
} from "./notifications/notificationCenter";
import {
  bindShellTransport,
  createShellSessionChannel,
  ensureAccountIntentListeners,
  ensureCatalogIntentListeners,
  ensureCommunityIntentListeners,
  ensureShellEventListeners,
  publishLogoutRequested,
  resetAccountIntentListeners,
  resetCatalogIntentListeners,
  resetCommunityIntentListeners,
  resetShellEventListeners,
  shellTransport,
  watchPostLikes,
} from "./events/eventBus";
import {
  subscribeToPostLikesChanged,
  subscribeToPostCreated,
} from "@shared/post-like-events";
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
import * as pageApps from "./utils/pageApps";
import {
  FOOTER_APP_NAME,
  HEADER_APP_NAME,
  PAGE_APP_NAMES,
  createPageAppRegistrations,
} from "./pages/pageRegistry";
import { persistAccountUpdate } from "./commands/accountCommands";
import { publishNotification } from "./notifications/notificationAdapter";
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

const catalogIntentHandlers = createCatalogIntentHandlers();
const communityIntentHandlers = createCommunityIntentHandlers(shellTransport, appState);

const accountIntentHandlers = {
  onProfileSaveRequested: (profilePayload) => {
    void persistAccountUpdate(shellTransport, appState, profilePayload);
  },
  onAddressSaveRequested: (addressPayload) => {
    void persistAccountUpdate(shellTransport, appState, { address: addressPayload });
  },
};

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
        appState.currentUser?.fullName || appState.currentUser?.username || "there";
      queueMicrotask(() => {
        authSession.sync();
        updateHeaderState(appState);
        // The reset cleared rendered toasts, so publish on the session the sync just opened.
        publishNotification({
          type: "success",
          title: "Signed in",
          message: `Welcome back, ${welcomeName}.`,
        });
      });
    } else {
      authSession.sync();
      // mesh.close() drops the header subscription, including on sign-out.
      updateHeaderState(appState);
    }
    // A profile refresh keeps the mounted page, so its action buttons survive a click.
    if (renderedSession.isSameSignedInUser()) {
      updateHeaderState(appState);
      return;
    }
    // Re-fetches posts so `likedByCurrentUser` matches the session that is active now.
    loadMockData(appState)
      .catch((loadError) => console.warn("onAuthSessionChanged - loadError", loadError))
      .finally(() => {
        reloadActivePageApp();
        renderedSession.remember();
      });
  },
  onLogoutRequested: () => {
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
      ensureAccountIntentListeners(accountIntentHandlers);
      ensureCommunityIntentListeners(communityIntentHandlers);
    },
    detachListeners: () => {
      resetNotificationDisplayListeners();
      resetShellEventListeners();
      resetCatalogIntentListeners();
      resetAccountIntentListeners();
      resetCommunityIntentListeners();
    },
    startLiveEvents: () => {
      void startSessionLiveEvents(shellTransport);
      void startNotificationInboxLiveEvents(shellTransport, { shell: "social" });
    },
    stopLiveEvents: () => {
      stopSessionLiveEvents();
      stopNotificationInboxLiveEvents();
    },
  },
);

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

function applyInitialAuthGuard() {
  const currentPathName = window.location.pathname;
  if (isProtectedRoute(currentPathName) && !isAuthenticated(appState)) {
    rememberPostLoginRedirect(currentPathName + window.location.search);
    history.replaceState({}, "", "/login");
  }
}

async function bootstrap() {
  readStoredAuth(appState);
  authSession.start();
  // These subscribes have to follow configureMesh. The first use initializes
  // EventMesh and a later configureMesh throws. They still run before any page mounts.
  const notificationMount = document.getElementById("notificationMount");
  if (notificationMount) {
    mountNotificationCenter(notificationMount);
  }
  // Global for the life of the tab (signed-in or guest), independent of which page is mounted:
  // keeps appState.posts correct for the next render.
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
  // The single place that inserts a new post. Page subscribers (feedPage.js, postsPage.js) only
  // re-render. addPostIfMissing skips a post the author's tab already holds from its own reply.
  subscribeToPostCreated(shellTransport, (newPost) => {
    addPostIfMissing(appState, { ...newPost, likedByCurrentUser: false });
    // A feed that has not rendered this post yet still needs its later like counts.
    watchPostLikes(newPost && newPost.id);
  });
  await loadMockData(appState);
  if (appState.authToken) {
    void refreshCurrentUserFromApi(appState);
  }

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
