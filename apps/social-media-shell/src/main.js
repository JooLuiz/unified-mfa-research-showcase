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
import { navigate } from "./utils/navigate";
import { createHeaderApp, createFooterApp } from "./utils/mountActions";
import {
  feedPageApp,
  postsPageApp,
  loginPageApp,
  accountPageApp,
} from "./utils/pageApps";
import { configureMesh } from "event-mesh/mesh";

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

function configureApplicationMesh() {
  configureMesh({
    gatewayUrl: "ws://localhost",
    gatewayPort: 3004,
    enableWebSocket: true,
  });
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

window.addEventListener("global:renderApp", () => {
  reloadActivePageApp();
});

window.addEventListener("auth:changed", () => {
  reloadActivePageApp();
});

window.addEventListener("auth:logout-request", () => {
  clearAuthSession(appState);
  navigate("/");
});

function applyInitialAuthGuard() {
  const currentPathName = window.location.pathname;
  if (isProtectedRoute(currentPathName) && !isAuthenticated(appState)) {
    rememberPostLoginRedirect(currentPathName + window.location.search);
    history.replaceState({}, "", "/login");
  }
}

async function bootstrap() {
  configureApplicationMesh();
  readStoredAuth(appState);
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
