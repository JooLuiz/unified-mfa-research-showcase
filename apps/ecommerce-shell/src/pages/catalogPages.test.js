/**
 * Verifies the product list and product details pages mount their catalog sections.
 * Role: Locks the sections the catalog routes leave in the page.
 * Not in this file: Product card rendering inside the remotes.
 * Key dependencies: node:test; src/pages/catalogPages.js; test/support/createPageDocument.js.
 * See also: src/pages/catalogPages.js.
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
const { renderProductListPage, renderProductDetailsPage } = await loadAppModule(
  new URL("./catalogPages.js", import.meta.url).href,
);

test("mounts the product list with the shopper's current filters", async () => {
  resetLocation("/start");
  const pageRoot = createPageRoot();
  const remotes = createRemoteRecorder();
  const appState = { plpFilters: { searchQuery: "mug" }, plpSortBy: "price" };
  await renderProductListPage(appState, pageRoot, remotes, []);
  const listProps = latestRemoteCall(remotes, "productList").props;
  assert.equal(pageRoot.querySelector("#plpMount").id, "plpMount");
  assert.equal(listProps.initialFilters.searchQuery, "mug");
  assert.equal(listProps.initialSort, "price");
  await invokeHandler(listProps, "onAddToCart", { productId: "sku-01", quantity: 1 });
});

test("mounts product details and similar products", async () => {
  resetLocation("/start");
  const pageRoot = createPageRoot();
  const remotes = createRemoteRecorder();
  await renderProductDetailsPage({}, pageRoot, remotes, []);
  assert.equal(pageRoot.querySelector("#pdpMount").id, "pdpMount");

  const detailsProps = latestRemoteCall(remotes, "productDetails").props;
  const similarMount = document.createElement("div");
  detailsProps.mountSimilarProducts(similarMount, {
    title: "Similar",
    productIds: ["sku-02"],
    apiBaseUrl: "http://localhost:4000/api",
  });
  const showcaseProps = latestRemoteCall(remotes, "showcase").props;
  assert.equal(showcaseProps.title, "Similar");
  assert.deepEqual(showcaseProps.productIds, ["sku-02"]);
  await invokeHandler(showcaseProps, "onAddToCart", { productId: "sku-02", quantity: 1 });
});
