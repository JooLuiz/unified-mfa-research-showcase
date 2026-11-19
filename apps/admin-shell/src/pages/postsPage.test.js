/**
 * Verifies the admin posts table shows authors and opens a post from a row.
 * Role: Locks the posts page outcome a shopper can see after the admin posts load.
 * Not in this file: Live post delivery.
 * Key dependencies: node:test; src/pages/postsPage.js; test/support/createPageDocument.js.
 * See also: src/pages/postsPage.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import "../../../../test/support/installBrowserGlobals.js";
import {
  installFetch,
  installPageDocument,
  resetLocation,
} from "../../../../test/support/createPageDocument.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

const { createPageRoot } = await installPageDocument();
const { renderPostsPage } = await loadAppModule(new URL("./postsPage.js", import.meta.url).href);

const samplePost = {
  id: "post-01",
  author: { fullName: "Ada Lovelace" },
  createdAt: "2026-01-02T15:04:00.000Z",
  content: "Hello community",
  likes: 2,
  comments: 1,
};

/**
 * Builds an admin session the posts page can send with its request.
 *
 * @returns {object} Shell state.
 */
function createAdmin() {
  return {
    authToken: "token-01",
    currentUser: { id: "admin-01", username: "ada", role: "admin" },
  };
}

test("shows each post and opens it when the row is clicked", async () => {
  installFetch((url) => {
    if (url.includes("/admin/posts")) {
      return { body: { items: [samplePost, { ...samplePost, id: "", content: "Skipped" }] } };
    }
    return { body: {} };
  });
  resetLocation("/all-posts");
  const pageRoot = createPageRoot();
  const cleanups = [];

  await renderPostsPage(createAdmin(), pageRoot, cleanups);

  assert.match(pageRoot.textContent, /All Posts/);
  assert.match(pageRoot.textContent, /Ada Lovelace/);
  assert.match(pageRoot.textContent, /Hello community/);
  pageRoot.querySelector("th").click();
  assert.equal(window.location.pathname, "/all-posts");

  pageRoot.querySelector("tr[data-post-id='']").click();
  assert.equal(window.location.pathname, "/all-posts");

  pageRoot.querySelector("tr[data-post-id='post-01'] td").click();
  assert.equal(window.location.pathname, "/posts/post-01");

  resetLocation("/all-posts");
  cleanups.forEach((cleanup) => cleanup());
  pageRoot.querySelector("tr[data-post-id='post-01'] td").click();
  assert.equal(window.location.pathname, "/all-posts");
});

test("shows an empty message when the admin has no posts", async () => {
  installFetch(() => ({ body: { items: [] } }));
  const pageRoot = createPageRoot();
  await renderPostsPage(createAdmin(), pageRoot, []);
  assert.match(pageRoot.textContent, /No posts found/);
});

test("shows an error when posts cannot be loaded", async () => {
  installFetch(() => ({ throwError: new Error("posts down") }));
  const pageRoot = createPageRoot();
  await renderPostsPage(createAdmin(), pageRoot, []);
  assert.match(pageRoot.textContent, /Unable to load posts/);
});
