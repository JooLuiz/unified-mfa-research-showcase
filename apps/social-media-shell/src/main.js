import "./styles.css";

import {
  readStoredAuth,
  clearAuthSession,
  isAuthenticated,
  isProtectedRoute,
  rememberPostLoginRedirect,
  refreshCurrentUserFromApi,
} from "./utils/authActions";

import loadRemoteModules from "./utils/loadRemoteModules";
import loadMockData from "./utils/loadData";

import { mountHeaderAndFooter } from "./utils/mountActions";
import { navigate } from "./utils/navigate";
import {
  renderFeedPage,
  renderPostsPage,
  renderLoginPage,
  renderAccountPage,
  persistNewPost,
} from "./utils/renderActions";

const appState = {
  posts: [],
  banners: [],
  products: [],
  productsById: {},
  showcases: [],
  authToken: null,
  currentUser: null,
};

let currentRenderId = 0;
let activeCleanupFunctions = [];

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

  if (isProtectedRoute(pathName) && !isAuthenticated(appState)) {
    rememberPostLoginRedirect(pathName + window.location.search);
    history.replaceState({}, "", "/login");
    window.dispatchEvent(new CustomEvent("global:renderApp"));
    return;
  }

  const layoutMounts = baseLayout();
  mountHeaderAndFooter(appState, layoutMounts);

  if (pathName === "/") {
    await renderFeedPage(appState, layoutMounts.pageMount, modules, activeCleanupFunctions);
    return;
  }

  if (pathName === "/posts") {
    await renderPostsPage(appState, layoutMounts.pageMount, modules, activeCleanupFunctions);
    return;
  }

  if (pathName === "/login") {
    await renderLoginPage(appState, layoutMounts.pageMount, modules, activeCleanupFunctions);
    return;
  }

  if (pathName === "/account") {
    await renderAccountPage(appState, layoutMounts.pageMount, modules, activeCleanupFunctions);
    return;
  }

  layoutMounts.pageMount.innerHTML = `
    <section class="notice-box">
      <h2>Page not found</h2>
      <button id="goHomeButton">Back to feed</button>
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
  renderApp();
});

window.addEventListener("auth:logout-request", () => {
  clearAuthSession(appState);
  navigate("/");
});

window.addEventListener("message", (event) => {
  const messageData = event.data;
  if (!messageData || typeof messageData !== "object") {
    return;
  }

  if (messageData.type === "iframe:resize") {
    const frameId = messageData.payload?.frameId;
    const rawHeight = Number(messageData.payload?.height);
    if (typeof frameId === "string" && Number.isFinite(rawHeight)) {
      const frameElement = document.querySelector(
        `iframe[data-frame-id="${frameId}"]`,
      );
      if (frameElement) {
        frameElement.style.height = `${Math.max(rawHeight, 80)}px`;
      }
    }
    return;
  }

  if (messageData.type === "post:form-submitted") {
    if (!isAuthenticated(appState)) {
      return;
    }
    const submittedPost = messageData.payload || {};
    void persistNewPost(appState, {
      content: submittedPost.content,
      imageUrl: submittedPost.imageUrl,
      authorId: appState.currentUser?.id,
    }).then((createdPost) => {
      if (createdPost) {
        renderApp();
      }
    });
  }
});

async function bootstrap() {
  readStoredAuth(appState);
  await loadMockData(appState);
  if (appState.authToken) {
    void refreshCurrentUserFromApi(appState);
  }
  await renderApp();
}

bootstrap().catch((error) => {
  const appRoot = document.getElementById("appRoot");
  appRoot.innerHTML = `<pre>Application bootstrap failed: ${error.message}</pre>`;
});
