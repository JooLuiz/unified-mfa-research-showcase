/**
 * Verifies the admin posts table markup for missing authors, excerpts, and like counts.
 * Role: Locks the row text the posts page renders for each post shape.
 * Not in this file: Fetching posts.
 * Key dependencies: node:test; src/pages/postsTableView.js; test/support/createPageDocument.js.
 * See also: src/pages/postsTableView.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import "../../../../test/support/installBrowserGlobals.js";
import { installPageDocument } from "../../../../test/support/createPageDocument.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

const { createPageRoot } = await installPageDocument();
const { buildPostRowMarkup, buildPostsTableMarkup, updatePostLikesRow } = await loadAppModule(
  new URL("./postsTableView.js", import.meta.url).href,
);

const createdAt = "2026-01-02T15:04:00.000Z";

test("renders author, excerpt, and count fallbacks", () => {
  const longContent = "a".repeat(90);
  const rows = [
    buildPostRowMarkup({
      id: "named",
      author: { username: "ada" },
      createdAt,
      content: "Short note",
      likes: null,
      comments: Number.NaN,
    }),
    buildPostRowMarkup({
      id: "blank",
      author: null,
      createdAt,
      content: "",
      likes: 4,
      comments: 3,
    }),
    buildPostRowMarkup({
      id: "long",
      author: { fullName: "Ada Lovelace" },
      createdAt,
      content: longContent,
      likes: 1,
      comments: 0,
    }),
  ].join("");
  const pageRoot = createPageRoot();
  pageRoot.innerHTML = `<table><tbody>${rows}</tbody></table>`;

  assert.match(pageRoot.textContent, /ada/);
  assert.match(pageRoot.textContent, /Short note/);
  assert.match(pageRoot.textContent, /Unknown author/);
  assert.match(pageRoot.textContent, new RegExp(`${"a".repeat(80)}…`));
  assert.match(pageRoot.textContent, /0/);
  assert.equal(buildPostsTableMarkup([]).includes("Author"), true);
});

test("patches the likes cell and ignores a missing row or cell", () => {
  const pageRoot = createPageRoot();
  pageRoot.innerHTML = buildPostsTableMarkup([
    {
      id: "post-01",
      author: { fullName: "Ada Lovelace" },
      createdAt,
      content: "Hello",
      likes: 1,
      comments: 0,
    },
  ]);
  updatePostLikesRow(pageRoot, { postId: "missing", likes: 9 });
  assert.match(pageRoot.querySelector(".admin-cell-likes").textContent, /1/);

  updatePostLikesRow(pageRoot, { postId: "post-01", likes: 8 });
  assert.equal(pageRoot.querySelector(".admin-cell-likes").textContent, "8");

  const bareRoot = createPageRoot();
  bareRoot.innerHTML = `<table><tbody><tr data-post-id="post-02"><td>Ada</td></tr></tbody></table>`;
  updatePostLikesRow(bareRoot, { postId: "post-02", likes: 3 });
  assert.equal(bareRoot.textContent.includes("Ada"), true);
  assert.equal(bareRoot.textContent.includes("3"), false);
});
