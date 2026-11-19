/**
 * Verifies promotion filters become the product list the shopper opens next.
 * Role: Locks the filter handoff and one banner mount per configured banner.
 * Not in this file: Banner artwork inside the banners remote.
 * Key dependencies: node:test; src/pages/promotionsPage.js; test/support/createPageDocument.js.
 * See also: src/pages/promotionsPage.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import "../../../../test/support/installBrowserGlobals.js";
import {
  createRemoteRecorder,
  installPageDocument,
  invokeHandler,
  latestRemoteCall,
  resetLocation,
} from "../../../../test/support/createPageDocument.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

const { createPageRoot } = await installPageDocument();
const { applyPromotionFilters, renderPromotionsPage } = await loadAppModule(
  new URL("./promotionsPage.js", import.meta.url).href,
);

test("stores banner filters and opens the product list", () => {
  resetLocation("/promotions");
  const appState = { plpFilters: {} };
  applyPromotionFilters(appState, null);
  assert.equal(window.location.pathname, "/products");
  assert.equal(appState.plpFilters.searchQuery, "");

  resetLocation("/promotions");
  applyPromotionFilters(appState, {
    searchQuery: "mug",
    minPrice: "5",
    maxPrice: "20",
    categoryIds: ["mugs", 4],
  });
  assert.equal(appState.plpFilters.searchQuery, "mug");
  assert.deepEqual(appState.plpFilters.categoryIds, ["mugs"]);
  assert.equal(window.location.pathname, "/products");
});

test("mounts one banner for each configured promotion", async () => {
  const pageRoot = createPageRoot();
  const remotes = createRemoteRecorder();
  await renderPromotionsPage({ banners: [] }, pageRoot, remotes, []);
  assert.equal(remotes.calls.length, 0);
  assert.equal(pageRoot.querySelector("#promotionsMount").className, "page-content");

  await renderPromotionsPage(
    { banners: [{ id: "banner-01" }, { id: "banner-02" }] },
    pageRoot,
    remotes,
    [],
  );
  assert.equal(remotes.calls.filter((call) => call.name === "banner").length, 2);
  const bannerProps = latestRemoteCall(remotes, "banner").props;
  assert.equal(bannerProps.bannerId, "banner-02");
});
