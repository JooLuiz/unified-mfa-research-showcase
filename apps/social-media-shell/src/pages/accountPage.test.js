/**
 * Verifies the social account page, sign-out, and the member's own posts.
 * Role: Locks the account heading, empty and counted post copy, and post navigation.
 * Not in this file: Live like delivery.
 * Key dependencies: node:test; src/pages/accountPage.js; test/support/createPageDocument.js.
 * See also: src/pages/accountPage.js.
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
const { renderAccountPage } = await loadAppModule(new URL("./accountPage.js", import.meta.url).href);

/**
 * Builds a signed-in member.
 *
 * @param {object[]} posts - Posts currently in the shell.
 * @returns {object} Shell state.
 */
function createMember(posts) {
  return {
    authToken: "token-01",
    currentUser: { id: "user-01", username: "ada", fullName: "Ada Lovelace" },
    posts,
  };
}

queueTest("sends a guest to login", async () => {
  resetLocation("/account");
  await renderAccountPage({ authToken: "", currentUser: null, posts: [] }, createPageRoot(), createRemoteRecorder(), []);
  assert.equal(window.location.pathname, "/login");
});

queueTest("shows an empty posts message and keeps the page when sign-out fails", async () => {
  installFetch((url) => {
    if (url.includes("sign-out-everywhere")) {
      return { throwError: new Error("sign out failed") };
    }
    return { body: {} };
  });
  resetLocation("/account");
  const pageRoot = createPageRoot();
  await renderAccountPage(createMember([]), pageRoot, createRemoteRecorder(), []);
  assert.match(pageRoot.textContent, /You have not shared any posts yet/);
  assert.equal(pageRoot.querySelector("#exportPostsButton"), null);

  pageRoot.querySelector("#backToFeedButton").click();
  assert.equal(window.location.pathname, "/");

  const signOutButton = pageRoot.querySelector("#signOutEverywhereButton");
  signOutButton.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(signOutButton.disabled, true);
  assert.match(pageRoot.textContent, /My Account/);
});

queueTest("counts the member's posts and opens the one they choose", async () => {
  installFetch(() => ({ ok: false, body: {} }));
  resetLocation("/feed");
  const pageRoot = createPageRoot();
  const remotes = createRemoteRecorder();
  const cleanups = [];
  const appState = createMember([
    { id: "post-01", authorId: "user-01", likes: 1 },
    { id: "post-02", authorId: "user-01", likes: 0 },
    { id: "post-03", authorId: "someone-else", likes: 4 },
  ]);
  await renderAccountPage(appState, pageRoot, remotes, cleanups);
  assert.match(pageRoot.textContent, /2 posts shared/);
  assert.equal(pageRoot.querySelector("#exportPostsButton").textContent.includes("Export CSV"), true);

  const feedProps = latestRemoteCall(remotes, "postFeed").props;
  assert.equal(feedProps.posts.length, 2);
  await invokeHandler(feedProps, "onAuthorClick", {});
  await invokeHandler(feedProps, "onAuthorClick", { username: "ada" });
  await invokeHandler(feedProps, "onPostClick", {});
  assert.equal(window.location.pathname, "/feed");
  await invokeHandler(feedProps, "onPostClick", { id: "post-01" });
  assert.equal(window.location.pathname, "/posts/post-01");
  await invokeHandler(feedProps, "onLike", "post-01");
  installFetch(() => ({ ok: false, body: {} }));
  pageRoot.querySelector("#exportPostsButton").click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  installFetch(() => ({ ok: true, body: {} }));
  pageRoot.querySelector("#exportPostsButton").click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.match(pageRoot.textContent, /2 posts shared/);
  cleanups.forEach((cleanup) => cleanup());

  const onePostRoot = createPageRoot();
  await renderAccountPage(
    createMember([{ id: "only-post", authorId: "user-01", likes: 0 }]),
    onePostRoot,
    createRemoteRecorder(),
    [],
  );
  assert.match(onePostRoot.textContent, /1 post shared/);
});
