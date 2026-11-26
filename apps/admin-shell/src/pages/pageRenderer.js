/**
 * Paints the admin page for the current location inside the shell layout.
 * Role: Owns the page cleanup list, the layout mounts, redirects, the access-denied exit, and
 *   stale-render checks.
 * Not in this file: Route decisions (src/pages/pageRegistry.js) or each page's markup.
 * Key dependencies: src/pages/pageRegistry.js; src/utils/renderActions.js; src/utils/mountActions.js.
 * See also: src/main.js.
 */

import { publishRenderRequested } from "../events/eventBus";
import { publishNotification } from "../notifications/notificationAdapter";
import { clearAuthSession, rememberPostLoginRedirect } from "../utils/authActions";
import { MOCK_API_BASE_URL } from "../utils/constants";
import { mountHeaderAndFooter } from "../utils/mountActions";
import { navigate } from "../utils/navigate";
import {
  renderAccountPage,
  renderDashboardPage,
  renderLoginPage,
  renderOrderDetailsPage,
  renderOrdersPage,
  renderPostsPage,
} from "../utils/renderActions";
import { resolvePageRoute } from "./pageRegistry";

/**
 * Mounts a remote page when it loaded and keeps its cleanup.
 *
 * @param {Function | undefined} mountRemote - Remote mount function.
 * @param {{ pageMount: HTMLElement, cleanups: Array<() => void> }} context - Page context.
 * @param {object} props - Remote props.
 * @returns {void}
 */
function mountOptionalRemote(mountRemote, { pageMount, cleanups }, props) {
  if (!mountRemote) {
    return;
  }
  const cleanupRemote = mountRemote(pageMount, props);
  if (typeof cleanupRemote === "function") {
    cleanups.push(cleanupRemote);
  }
}

/**
 * Shows the not-found notice with a way home.
 *
 * @param {{ pageMount: HTMLElement }} context - Page context.
 * @returns {void}
 */
function renderNotFoundPage({ pageMount }) {
  pageMount.innerHTML = `
    <section class="notice-box">
      <h2>Page not found</h2>
      <button id="goHomeButton">Go Home</button>
    </section>
  `;
  pageMount.querySelector("#goHomeButton").addEventListener("click", () => navigate("/"));
}

const PAGE_RENDERERS = {
  login: ({ appState, pageMount, modules, cleanups }) =>
    renderLoginPage(appState, pageMount, modules, cleanups),
  dashboard: ({ appState, pageMount, cleanups }) => renderDashboardPage(appState, pageMount, cleanups),
  orders: ({ appState, pageMount, cleanups }) => renderOrdersPage(appState, pageMount, cleanups),
  orderDetails: ({ appState, pageMount, modules, cleanups }) =>
    renderOrderDetailsPage(appState, pageMount, modules, cleanups),
  singlePost: (context) =>
    mountOptionalRemote(context.modules.mountSinglePost, context, {
      postId: context.route.postId,
      apiBaseUrl: MOCK_API_BASE_URL,
      authToken: context.appState.authToken,
      currentUserId: context.appState.currentUser?.id,
      navigate,
      canLike: false,
    }),
  notifications: (context) =>
    mountOptionalRemote(context.modules.mountNotificationsPage, context, { navigate }),
  posts: ({ appState, pageMount, cleanups }) => renderPostsPage(appState, pageMount, cleanups),
  account: ({ appState, pageMount, cleanups }) => renderAccountPage(appState, pageMount, cleanups),
  notFound: renderNotFoundPage,
};

/**
 * Writes the shell layout into the app root and returns its mount points.
 *
 * @param {HTMLElement} appRoot - Shell root element.
 * @returns {{ headerMount: HTMLElement, pageMount: HTMLElement, footerMount: HTMLElement }} Mounts.
 */
function renderBaseLayout(appRoot) {
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

/**
 * Applies a redirect decision: remembers the return path or ends a non-admin session first.
 *
 * @param {{ redirect: string, rememberPath?: string, accessDenied?: boolean }} route - Redirect decision.
 * @param {object} appState - Shell state.
 * @returns {void}
 * @sideEffects May clear the session and toast, then replaces the history entry.
 */
function applyRedirect(route, appState) {
  if (route.rememberPath) {
    rememberPostLoginRedirect(route.rememberPath);
  }
  if (route.accessDenied) {
    clearAuthSession(appState);
    publishNotification({
      type: "error",
      title: "Access denied",
      message: "This account does not have admin access.",
    });
  }
  history.replaceState({}, "", route.redirect);
}

/**
 * Creates the renderer that repaints the admin shell for the current location.
 *
 * @param {{
 *   appState: object,
 *   loadModules: () => Promise<object>,
 *   marker: { beginRender: () => number, isLatestRender: (id: number) => boolean, remember: (id: number) => void },
 *   pages?: Record<string, (context: object) => Promise<void> | void>,
 *   mountLayout?: typeof mountHeaderAndFooter,
 *   requestRender?: () => void,
 *   getAppRoot?: () => HTMLElement,
 * }} options - Shell state, remote loader, render marker, and replaceable collaborators.
 * @returns {{ render: () => Promise<void>, getHeaderElement: () => HTMLElement | null }} Renderer.
 */
function createPageRenderer({
  appState,
  loadModules,
  marker,
  pages = PAGE_RENDERERS,
  mountLayout = mountHeaderAndFooter,
  requestRender = publishRenderRequested,
  getAppRoot = () => document.getElementById("appRoot"),
}) {
  let cleanups = [];
  let headerElement = null;

  function clearCurrentPage() {
    cleanups.forEach((cleanup) => {
      if (typeof cleanup === "function") {
        cleanup();
      }
    });
    cleanups = [];
    headerElement = null;
  }

  async function render() {
    const renderId = marker.beginRender();
    clearCurrentPage();

    let modules;
    try {
      modules = await loadModules();
    } catch (error) {
      getAppRoot().innerHTML = `<pre>Unable to load remotes: ${error.message}</pre>`;
      return;
    }
    if (!marker.isLatestRender(renderId)) {
      return;
    }

    const route = resolvePageRoute(window.location, appState);
    if (route.redirect) {
      applyRedirect(route, appState);
      requestRender();
      return;
    }

    const layoutMounts = renderBaseLayout(getAppRoot());
    headerElement = mountLayout(appState, layoutMounts, modules, cleanups);
    try {
      await pages[route.page]({
        appState,
        pageMount: layoutMounts.pageMount,
        modules,
        cleanups,
        route,
      });
    } finally {
      marker.remember(renderId);
    }
  }

  return {
    render,
    getHeaderElement() {
      return headerElement;
    },
  };
}

export { createPageRenderer, PAGE_RENDERERS };
