/**
 * Paints the ecommerce page for the current location inside the shell layout.
 * Role: Owns the page cleanup list, the layout mounts, redirects, and stale-render checks.
 * Not in this file: Route decisions (src/pages/pageRegistry.js) or each page's markup.
 * Key dependencies: src/pages/pageRegistry.js; src/utils/renderActions.js; src/utils/mountActions.js.
 * See also: src/main.js.
 */

import { publishRenderRequested } from "../events/eventBus";
import { rememberPostLoginRedirect } from "../utils/authActions";
import { mountHeaderAndFooter } from "../utils/mountActions";
import { navigate } from "../utils/navigate";
import {
  renderAccountPage,
  renderCheckoutPage,
  renderHomePage,
  renderLoginPage,
  renderOrderDetailsPage,
  renderOrderPlacedPage,
  renderProductDetailsPage,
  renderProductListPage,
  renderPromotionsPage,
} from "../utils/renderActions";
import { resolvePageRoute } from "./pageRegistry";

/**
 * Mounts the notifications remote when it loaded.
 *
 * @param {{ pageMount: HTMLElement, modules: object, cleanups: Array<() => void> }} context - Page context.
 * @returns {void}
 */
function renderNotificationsPage({ pageMount, modules, cleanups }) {
  if (!modules.mountNotificationsPage) {
    return;
  }
  const cleanupNotifications = modules.mountNotificationsPage(pageMount, { navigate });
  if (typeof cleanupNotifications === "function") {
    cleanups.push(cleanupNotifications);
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
  home: ({ appState, pageMount, modules, cleanups }) =>
    renderHomePage(appState, pageMount, modules, cleanups),
  products: ({ appState, pageMount, modules, cleanups }) =>
    renderProductListPage(appState, pageMount, modules, cleanups),
  promotions: ({ appState, pageMount, modules, cleanups }) =>
    renderPromotionsPage(appState, pageMount, modules, cleanups),
  productDetails: ({ appState, pageMount, modules, cleanups }) =>
    renderProductDetailsPage(appState, pageMount, modules, cleanups),
  checkout: ({ appState, pageMount, modules, cleanups }) =>
    renderCheckoutPage(appState, pageMount, modules, cleanups),
  orderPlaced: ({ pageMount }) => renderOrderPlacedPage(pageMount),
  login: ({ appState, pageMount, modules, cleanups }) =>
    renderLoginPage(appState, pageMount, modules, cleanups),
  account: ({ appState, pageMount, cleanups }) => renderAccountPage(appState, pageMount, cleanups),
  orderDetails: ({ appState, pageMount, modules, cleanups }) =>
    renderOrderDetailsPage(appState, pageMount, modules, cleanups),
  notifications: renderNotificationsPage,
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
 * Creates the renderer that repaints the shell for the current location.
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
      if (route.rememberPath) {
        rememberPostLoginRedirect(route.rememberPath);
      }
      history.replaceState({}, "", route.redirect);
      requestRender();
      return;
    }

    const layoutMounts = renderBaseLayout(getAppRoot());
    headerElement = mountLayout(appState, layoutMounts, modules, cleanups);
    try {
      await pages[route.page]({ appState, pageMount: layoutMounts.pageMount, modules, cleanups });
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
