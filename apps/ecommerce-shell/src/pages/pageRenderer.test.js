/**
 * Verifies the ecommerce shell paints one page per location and cleans up the previous one.
 * Role: Locks layout, redirect, stale-render, and load-failure outcomes on every comparison branch.
 * Not in this file: Each page's own markup. Pages and the header mount are recording fakes here.
 * Key dependencies: node:test; src/pages/pageRenderer.js; test/support/createPageDocument.js;
 *   @shared/shell-events createRenderedSessionMarker.
 * See also: src/pages/pageRenderer.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import "../../../../test/support/installBrowserGlobals.js";
import {
  createRemoteRecorder,
  installPageDocument,
  resetLocation,
} from "../../../../test/support/createPageDocument.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";
import { createRenderedSessionMarker } from "../../../../packages/shell-events/src/createRenderedSessionMarker.js";

const { createPageRoot } = await installPageDocument();
const { createPageRenderer, PAGE_RENDERERS } = await loadAppModule(
  new URL("./pageRenderer.js", import.meta.url).href,
);
const { consumePostLoginRedirect } = await loadAppModule(
  new URL("../utils/authActions.js", import.meta.url).href,
);

/**
 * Builds a renderer whose pages, header, and render requests are recorded.
 *
 * @param {{ appState?: object, loadModules?: () => Promise<object> }} [overrides] - Test inputs.
 * @returns {{ renderer: object, appRoot: object, painted: string[], cleaned: string[], renderRequests: number[], appState: object }}
 */
function createRecordedRenderer(overrides = {}) {
  const appState = overrides.appState || { authToken: "token-01", currentUser: { id: "user-01" } };
  const appRoot = createPageRoot();
  const painted = [];
  const cleaned = [];
  const renderRequests = [];
  const recordPage = (key) => ({ pageMount, cleanups }) => {
    painted.push(key);
    pageMount.innerHTML = `<p id="page">${key}</p>`;
    cleanups.push(() => cleaned.push(key));
  };
  const pages = Object.fromEntries(Object.keys(PAGE_RENDERERS).map((key) => [key, recordPage(key)]));
  const renderer = createPageRenderer({
    appState,
    loadModules: overrides.loadModules || (async () => createRemoteRecorder()),
    marker: createRenderedSessionMarker(appState),
    pages,
    mountLayout: () => ({ id: "header" }),
    requestRender: () => renderRequests.push(1),
    getAppRoot: () => appRoot,
  });
  return { renderer, appRoot, painted, cleaned, renderRequests, appState };
}

test("paints the page for the location inside the shell layout and cleans it up on the next render", async () => {
  const { renderer, appRoot, painted, cleaned } = createRecordedRenderer();
  resetLocation("/products");
  await renderer.render();
  assert.equal(appRoot.querySelector("#page").textContent, "products");
  assert.deepEqual(renderer.getHeaderElement(), { id: "header" });

  resetLocation("/");
  await renderer.render();
  assert.deepEqual(painted, ["products", "home"]);
  assert.deepEqual(cleaned, ["products"]);
});

test("a guest on checkout is sent to login and returns to checkout afterwards", async () => {
  const { renderer, painted, renderRequests } = createRecordedRenderer({
    appState: { authToken: null, currentUser: null },
  });
  resetLocation("/checkout", "?step=2");
  await renderer.render();
  assert.equal(window.location.pathname, "/login");
  assert.equal(consumePostLoginRedirect(), "/checkout?step=2");
  assert.deepEqual(painted, []);
  assert.equal(renderRequests.length, 1);
});

test("a legacy order link is rewritten without remembering a sign-in return", async () => {
  const { renderer, renderRequests } = createRecordedRenderer();
  resetLocation("/order-details", "?orderId=order-01");
  await renderer.render();
  assert.equal(window.location.pathname, "/order-details/order-01");
  assert.equal(consumePostLoginRedirect(), null);
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
          releaseFirstLoad = () => resolve(createRemoteRecorder());
        });
      }
      return Promise.resolve(createRemoteRecorder());
    },
  });
  resetLocation("/promotions");
  const firstRender = renderer.render();
  await renderer.render();
  releaseFirstLoad();
  await firstRender;
  assert.deepEqual(painted, ["promotions"]);
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

test("the not-found page offers a way home", async () => {
  const pageMount = createPageRoot();
  resetLocation("/missing");
  PAGE_RENDERERS.notFound({ pageMount });
  assert.equal(pageMount.querySelector("h2").textContent, "Page not found");
  pageMount.querySelector("#goHomeButton").click();
  assert.equal(window.location.pathname, "/");
});

test("the notifications page mounts its remote when it loaded, and stays empty otherwise", () => {
  const pageMount = createPageRoot();
  const cleanups = [];
  const mounted = [];
  PAGE_RENDERERS.notifications({
    pageMount,
    cleanups,
    modules: {
      mountNotificationsPage: (element, props) => {
        mounted.push(typeof props.navigate);
        return () => {};
      },
    },
  });
  PAGE_RENDERERS.notifications({ pageMount, cleanups, modules: {} });
  PAGE_RENDERERS.notifications({
    pageMount,
    cleanups,
    modules: { mountNotificationsPage: () => undefined },
  });
  assert.deepEqual(mounted, ["function"]);
  assert.equal(cleanups.length, 1);
});
