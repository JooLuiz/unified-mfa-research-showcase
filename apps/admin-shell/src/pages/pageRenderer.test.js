/**
 * Verifies the admin shell paints one page per location, gates non-admins, and cleans up.
 * Role: Locks layout, redirect, access-denied, stale-render, and load-failure outcomes on every
 *   comparison branch.
 * Not in this file: Each page's own markup. Pages and the header mount are recording fakes here.
 * Key dependencies: node:test; src/pages/pageRenderer.js; test/support/createPageDocument.js;
 *   @shared/shell-events createRenderedSessionMarker.
 * See also: src/pages/pageRenderer.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import "../../../../test/support/installBrowserGlobals.js";
import { installPageDocument, resetLocation } from "../../../../test/support/createPageDocument.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";
import { createRenderedSessionMarker } from "../../../../packages/shell-events/src/createRenderedSessionMarker.js";

const { createPageRoot } = await installPageDocument();
const { createPageRenderer, PAGE_RENDERERS } = await loadAppModule(
  new URL("./pageRenderer.js", import.meta.url).href,
);
const { consumePostLoginRedirect } = await loadAppModule(
  new URL("../utils/authActions.js", import.meta.url).href,
);
const { subscribeToNotifications } = await loadAppModule(
  new URL("../notifications/notificationAdapter.js", import.meta.url).href,
);

/**
 * Builds a renderer whose pages, header, and render requests are recorded.
 *
 * @param {{ appState?: object, loadModules?: () => Promise<object> }} [overrides] - Test inputs.
 * @returns {{ renderer: object, appRoot: object, painted: string[], cleaned: string[], renderRequests: number[], appState: object }}
 */
function createRecordedRenderer(overrides = {}) {
  const appState = overrides.appState || {
    authToken: "token-01",
    currentUser: { id: "admin-01", role: "admin" },
  };
  const appRoot = createPageRoot();
  const painted = [];
  const cleaned = [];
  const renderRequests = [];
  const recordPage = (key) => ({ pageMount, cleanups, route }) => {
    painted.push(route.postId ? `${key}:${route.postId}` : key);
    pageMount.innerHTML = `<p id="page">${key}</p>`;
    cleanups.push(() => cleaned.push(key));
  };
  const pages = Object.fromEntries(Object.keys(PAGE_RENDERERS).map((key) => [key, recordPage(key)]));
  const renderer = createPageRenderer({
    appState,
    loadModules: overrides.loadModules || (async () => ({})),
    marker: createRenderedSessionMarker(appState),
    pages,
    mountLayout: () => ({ id: "header" }),
    requestRender: () => renderRequests.push(1),
    getAppRoot: () => appRoot,
  });
  return { renderer, appRoot, painted, cleaned, renderRequests, appState };
}

test("paints the admin page for the location and cleans it up on the next render", async () => {
  const { renderer, appRoot, painted, cleaned } = createRecordedRenderer();
  resetLocation("/orders");
  await renderer.render();
  assert.equal(appRoot.querySelector("#page").textContent, "orders");
  assert.deepEqual(renderer.getHeaderElement(), { id: "header" });

  resetLocation("/posts/post-07");
  await renderer.render();
  assert.deepEqual(painted, ["orders", "singlePost:post-07"]);
  assert.deepEqual(cleaned, ["orders"]);
});

test("a guest is sent to login and returns to the page afterwards", async () => {
  const { renderer, painted, renderRequests } = createRecordedRenderer({
    appState: { authToken: null, currentUser: null },
  });
  resetLocation("/orders", "?page=2");
  await renderer.render();
  assert.equal(window.location.pathname, "/login");
  assert.equal(consumePostLoginRedirect(), "/orders?page=2");
  assert.deepEqual(painted, []);
  assert.equal(renderRequests.length, 1);
});

test("a non-admin is signed out, told why, and sent to login", async () => {
  const notices = [];
  const unsubscribe = subscribeToNotifications((notice) => notices.push(notice));
  const { renderer, appState, renderRequests } = createRecordedRenderer({
    appState: { authToken: "token-02", currentUser: { id: "user-01", role: "customer" } },
  });
  try {
    resetLocation("/orders");
    await renderer.render();
  } finally {
    unsubscribe();
  }
  assert.equal(window.location.pathname, "/login");
  assert.equal(appState.authToken, null);
  assert.equal(notices.some((notice) => notice.title === "Access denied"), true);
  assert.equal(renderRequests.length, 1);
});

test("an older render that finishes late paints nothing", async () => {
  let releaseFirstLoad;
  let loads = 0;
  const { renderer, painted } = createRecordedRenderer({
    loadModules: () => {
      loads += 1;
      if (loads === 1) {
        return new Promise((resolve) => {
          releaseFirstLoad = () => resolve({});
        });
      }
      return Promise.resolve({});
    },
  });
  resetLocation("/");
  const firstRender = renderer.render();
  await renderer.render();
  releaseFirstLoad();
  await firstRender;
  assert.deepEqual(painted, ["dashboard"]);
});

test("a remote load failure is shown instead of a page", async () => {
  const { renderer, appRoot, painted } = createRecordedRenderer({
    loadModules: async () => {
      throw new Error("offline");
    },
  });
  resetLocation("/");
  await renderer.render();
  assert.equal(appRoot.querySelector("pre").textContent, "Unable to load remotes: offline");
  assert.deepEqual(painted, []);
});

test("the not-found page offers a way home", () => {
  const pageMount = createPageRoot();
  resetLocation("/missing");
  PAGE_RENDERERS.notFound({ pageMount });
  assert.equal(pageMount.querySelector("h2").textContent, "Page not found");
  pageMount.querySelector("#goHomeButton").click();
  assert.equal(window.location.pathname, "/");
});

test("remote pages mount when loaded with the post and session, and stay empty otherwise", () => {
  const pageMount = createPageRoot();
  const cleanups = [];
  const mounted = [];
  const appState = { authToken: "token-01", currentUser: { id: "admin-01" } };
  const modules = {
    mountSinglePost: (_element, props) => {
      mounted.push({ postId: props.postId, canLike: props.canLike, userId: props.currentUserId });
      return () => {};
    },
    mountNotificationsPage: () => undefined,
  };
  PAGE_RENDERERS.singlePost({ appState, pageMount, cleanups, modules, route: { postId: "post-07" } });
  PAGE_RENDERERS.notifications({ appState, pageMount, cleanups, modules, route: {} });
  PAGE_RENDERERS.singlePost({ appState, pageMount, cleanups, modules: {}, route: { postId: "x" } });
  assert.deepEqual(mounted, [{ postId: "post-07", canLike: false, userId: "admin-01" }]);
  assert.equal(cleanups.length, 1);
});
