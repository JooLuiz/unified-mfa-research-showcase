/**
 * Verifies the social feed shows trending posts and featured products.
 * Role: Locks the trending list, the empty message, and the showcase the feed mounts.
 * Not in this file: Live like delivery.
 * Key dependencies: node:test; src/pages/feedPage.js; test/support/createPageDocument.js.
 * See also: src/pages/feedPage.js.
 */

import assert from "node:assert/strict";
import "../../../../test/support/installBrowserGlobals.js";
import {
  createRemoteRecorder,
  installFetch,
  installPageDocument,
  invokeHandler,
  latestRemoteCall,
  queueTest,
  resetLocation,
} from "../../../../test/support/createPageDocument.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

const { createPageRoot } = await installPageDocument();
const { renderFeedPage } = await loadAppModule(new URL("./feedPage.js", import.meta.url).href);

queueTest("shows only posts that have reached the trending count", async () => {
  installFetch(() => ({ ok: false, body: {} }));
  resetLocation("/feed");
  const pageRoot = createPageRoot();
  const remotes = createRemoteRecorder();
  const cleanups = [];
  const appState = {
    authToken: "token-01",
    currentUser: { id: "user-01", username: "ada" },
    posts: [
      { id: "quiet", likes: 0 },
      { id: "loud", likes: 2 },
    ],
    showcases: [{ showcaseTitle: "Summer picks", productIds: ["mug", "missing"] }],
    productsById: { mug: { id: "mug", name: "Mug" } },
  };
  await renderFeedPage(appState, pageRoot, remotes, cleanups);

  const feedProps = latestRemoteCall(remotes, "postFeed").props;
  assert.equal(feedProps.title, "Trending Posts");
  assert.deepEqual(feedProps.posts.map((post) => post.id), ["loud"]);
  assert.equal(feedProps.emptyStateMessage, "No trending posts yet.");

  await invokeHandler(feedProps, "onAuthorClick", {});
  await invokeHandler(feedProps, "onAuthorClick", { username: "ada" });
  await invokeHandler(feedProps, "onPostClick", {});
  assert.equal(window.location.pathname, "/feed");
  await invokeHandler(feedProps, "onPostClick", { id: "loud" });
  assert.equal(window.location.pathname, "/posts/loud");
  await invokeHandler(feedProps, "onLike", "loud");

  const showcase = pageRoot.querySelector("angular-product-showcase");
  assert.equal(showcase.config.title, "Summer picks");
  assert.equal(showcase.config.products.length, 1);

  cleanups.forEach((cleanup) => cleanup());
  assert.equal(pageRoot.querySelector("angular-product-showcase"), null);
});

queueTest("uses the featured title when a showcase has no title of its own", async () => {
  const pageRoot = createPageRoot();
  const remotes = createRemoteRecorder();
  await renderFeedPage(
    {
      posts: [],
      currentUser: null,
      showcases: [{ productIds: ["mug"] }],
      productsById: { mug: { id: "mug", name: "Mug" } },
    },
    pageRoot,
    remotes,
    [],
  );
  assert.deepEqual(latestRemoteCall(remotes, "postFeed").props.posts, []);
  assert.equal(pageRoot.querySelector("angular-product-showcase").config.title, "Featured Products");
});

queueTest("skips the showcase when it has no products", async () => {
  const pageRoot = createPageRoot();
  await renderFeedPage(
    { posts: [], currentUser: null, showcases: [{ productIds: [] }], productsById: {} },
    pageRoot,
    createRemoteRecorder(),
    [],
  );
  assert.equal(pageRoot.querySelector("angular-product-showcase"), null);
});
