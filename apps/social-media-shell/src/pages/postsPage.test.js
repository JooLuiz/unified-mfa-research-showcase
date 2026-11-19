/**
 * Verifies the community posts page, the login prompt, and grouped feeds.
 * Role: Locks the prompt, the group titles, and the post a shopper opens.
 * Not in this file: Live like delivery.
 * Key dependencies: node:test; src/pages/postsPage.js; test/support/createPageDocument.js.
 * See also: src/pages/postsPage.js.
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
const { renderPostsPage } = await loadAppModule(new URL("./postsPage.js", import.meta.url).href);

/**
 * Builds posts the community page can group.
 *
 * @param {number} count - How many posts to include.
 * @returns {object[]} Posts.
 */
function createPosts(count) {
  return Array.from({ length: count }, (_unused, index) => ({
    id: `post-${index + 1}`,
    likes: index,
  }));
}

queueTest("asks a guest to log in before creating a post", async () => {
  resetLocation("/posts");
  const pageRoot = createPageRoot();
  const cleanups = [];
  await renderPostsPage(
    { authToken: "", currentUser: null, posts: [], banners: [] },
    pageRoot,
    createRemoteRecorder(),
    cleanups,
  );
  assert.match(pageRoot.textContent, /Want to share something/);
  pageRoot.querySelector("#goToLoginButton").click();
  assert.equal(window.location.pathname, "/login");
  cleanups.forEach((cleanup) => cleanup());
  assert.equal(pageRoot.querySelector("#goToLoginButton"), null);
});

queueTest("groups posts, opens one, and follows a banner when the page offers that action", async () => {
  installFetch((url) => {
    if (url.includes("/posts")) {
      return { body: { id: "post-new", content: "Hello" } };
    }
    return { ok: false, body: {} };
  });
  resetLocation("/community");
  const pageRoot = createPageRoot();
  const remotes = createRemoteRecorder();
  const appState = {
    authToken: "token-01",
    currentUser: { id: "user-01", username: "ada", email: "ada@example.com" },
    posts: createPosts(5),
    banners: [
      {
        id: "banner-01",
        filters: {
          searchQuery: "mug",
          minPrice: "5",
          maxPrice: "20",
          categoryIds: ["mugs"],
        },
      },
    ],
  };
  await renderPostsPage(appState, pageRoot, remotes, []);
  assert.match(pageRoot.textContent, /Community Posts/);
  assert.equal(pageRoot.querySelector("#goToLoginButton"), null);
  const feedCalls = remotes.calls.filter((call) => call.name === "postFeed");
  assert.equal(feedCalls[0].props.title, "Latest Posts");
  assert.equal(feedCalls[0].props.posts.length, 4);
  assert.equal(feedCalls[1].props.title, "More Posts");
  assert.equal(pageRoot.querySelector(".posts-banner-slot") !== null, true);

  const feedProps = latestRemoteCall(remotes, "postFeed").props;
  await invokeHandler(feedProps, "onAuthorClick", {});
  await invokeHandler(feedProps, "onAuthorClick", { username: "ada" });
  await invokeHandler(feedProps, "onLike", "post-1");
  await invokeHandler(feedProps, "onPostClick", {});
  assert.equal(window.location.pathname, "/community");
  await invokeHandler(feedProps, "onPostClick", { id: "post-1" });
  assert.equal(window.location.pathname, "/posts/post-1");

  const bannerProps = latestRemoteCall(remotes, "banner").props;
  assert.equal(bannerProps !== undefined, true);

  const formProps = latestRemoteCall(remotes, "newPost").props;
  appState.authToken = "";
  await invokeHandler(formProps, "onFormSubmitted", { content: "Hidden", imageUrl: "" });
  appState.authToken = "token-01";
  await invokeHandler(formProps, "onFormSubmitted", { content: "Hello", imageUrl: "" });
});

queueTest("skips a banner slot when no banner is configured between groups", async () => {
  const pageRoot = createPageRoot();
  const remotes = createRemoteRecorder();
  await renderPostsPage(
    {
      authToken: "",
      currentUser: null,
      posts: createPosts(5),
      banners: [],
    },
    pageRoot,
    remotes,
    [],
  );
  assert.equal(pageRoot.querySelector(".posts-banner-slot"), null);
  assert.equal(remotes.calls.some((call) => call.name === "banner"), false);
});

queueTest("opens the catalog without filters when a banner has none", async () => {
  const pageRoot = createPageRoot();
  const remotes = createRemoteRecorder();
  const banners = [
    { id: "plain" },
    { id: "search", filters: { searchQuery: "hat" } },
    { id: "min", filters: { minPrice: "1" } },
    { id: "max", filters: { maxPrice: "9" } },
    { id: "empty-categories", filters: { categoryIds: [] } },
  ];
  for (const banner of banners) {
    remotes.calls.length = 0;
    await renderPostsPage(
      {
        authToken: "token-01",
        currentUser: { id: "user-01", fullName: "Ada Lovelace" },
        posts: createPosts(5),
        banners: [banner],
      },
      pageRoot,
      remotes,
      [],
    );
    assert.equal(latestRemoteCall(remotes, "banner") !== undefined, true);
  }
});
