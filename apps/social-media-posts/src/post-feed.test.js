/**
 * Verifies the post feed empty message and the card a shopper opens.
 * Role: Locks the empty copy and the one post click shared by both comparison branches.
 * Not in this file: Like writes and live like delivery.
 * Key dependencies: node:test; src/post-feed.js; test/support/installDomDocument.js.
 * See also: src/post-feed.js; src/post-card.test.js.
 */

import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";
import { act } from "react";
import "../../../test/support/installBrowserGlobals.js";
import { findElement, installDomDocument } from "../../../test/support/installDomDocument.js";
import { loadAppModule } from "../../../test/support/loadAppModule.js";

const jsxLoader = register(new URL("../../../scripts/test/jsxLoader.mjs", import.meta.url), import.meta.url);
if (jsxLoader && typeof jsxLoader.then === "function") {
  await jsxLoader;
}

const { mountPostFeed } = await loadAppModule(
  new URL("./post-feed.js", import.meta.url).href,
);

/**
 * Mounts a post feed into a fresh document.
 *
 * @param {object} props - Feed props passed to mountPostFeed.
 * @returns {{ root: object, unmount: () => void }} Mounted feed.
 */
function mountFeed(props) {
  const { root } = installDomDocument();
  let unmountFeed;
  act(() => {
    unmountFeed = mountPostFeed(root, props);
  });
  return {
    root,
    unmount() {
      act(() => {
        unmountFeed();
      });
    },
  };
}

test("an empty feed shows the default empty message", () => {
  const mounted = mountFeed({ posts: [] });

  try {
    assert.match(mounted.root.textContent, /No posts available right now\./);
  } finally {
    mounted.unmount();
  }
});

test("an empty feed shows a custom empty message", () => {
  const mounted = mountFeed({
    posts: [],
    emptyStateMessage: "The community is quiet.",
  });

  try {
    assert.match(mounted.root.textContent, /The community is quiet\./);
    assert.equal(mounted.root.textContent.includes("No posts available right now."), false);
  } finally {
    mounted.unmount();
  }
});

test("clicking a post calls the open handler once with that post", () => {
  const openedPostIds = [];
  const post = {
    id: "post-01",
    content: "Hello",
    likes: 2,
    author: { id: "author-01", fullName: "Ada" },
  };
  const mounted = mountFeed({
    posts: [post],
    onPostClick(clickedPost) {
      openedPostIds.push(clickedPost.id);
    },
  });

  try {
    const article = findElement(mounted.root, (node) => node.nodeName === "ARTICLE");
    act(() => {
      article.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    assert.deepEqual(openedPostIds, ["post-01"]);
  } finally {
    mounted.unmount();
  }
});

test("a feed shows the default title, a custom title, or no title, in list or grid layout", () => {
  const posts = [{ id: "post-01", content: "Hello", author: { fullName: "Ada" } }];
  const mounted = mountFeed({ posts });

  try {
    assert.match(mounted.root.textContent, /Latest Posts/);
    const list = findElement(mounted.root, (node) => node.classList && node.classList.contains("post-feed-list"));
    assert.equal(list.classList.contains("post-feed-grid"), false);
  } finally {
    mounted.unmount();
  }

  const custom = mountFeed({ posts, title: "Trending", layoutMode: "grid" });
  try {
    assert.match(custom.root.textContent, /Trending/);
    const grid = findElement(custom.root, (node) => node.classList && node.classList.contains("post-feed-list"));
    assert.equal(grid.classList.contains("post-feed-grid"), true);
  } finally {
    custom.unmount();
  }

  const untitled = mountFeed({ posts, title: "" });
  try {
    assert.equal(findElement(untitled.root, (node) => node.classList && node.classList.contains("post-feed-title")), null);
    assert.match(untitled.root.textContent, /Hello/);
  } finally {
    untitled.unmount();
  }
});
