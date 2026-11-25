/**
 * Verifies the post card text and disabled like button a shopper can see.
 * Role: Locks author and date fallbacks, like counts, disabled likes, and author vs card clicks shared by both comparison branches.
 * Not in this file: The like write and live like delivery.
 * Key dependencies: node:test; src/post-card.js; test/support/installDomDocument.js.
 * See also: src/post-card.js; src/post-feed.test.js.
 */

import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import "../../../test/support/installBrowserGlobals.js";
import { findElement, installDomDocument } from "../../../test/support/installDomDocument.js";
import { loadAppModule } from "../../../test/support/loadAppModule.js";

const jsxLoader = register(new URL("../../../scripts/test/jsxLoader.mjs", import.meta.url), import.meta.url);
if (jsxLoader && typeof jsxLoader.then === "function") {
  await jsxLoader;
}

const { PostCardView } = await loadAppModule(
  new URL("./post-card.js", import.meta.url).href,
);

/**
 * Mounts one post card.
 *
 * @param {object} props - Card props. The like callback stays unset.
 * @returns {{ root: object, unmount: () => void }} Mounted card.
 */
function mountCard(props) {
  const { root } = installDomDocument();
  const reactRoot = createRoot(root);
  act(() => {
    reactRoot.render(createElement(PostCardView, props));
  });
  return {
    root,
    unmount() {
      act(() => {
        reactRoot.unmount();
      });
    },
  };
}

/**
 * Finds the like button in a mounted card.
 *
 * @param {object} root - Mounted card root.
 * @returns {object | null} The like button.
 */
function findLikeButton(root) {
  return findElement(
    root,
    (node) => node.classList && node.classList.contains("post-card-action"),
  );
}

test("a card with no author and no likes shows the fallback name and a zero count", () => {
  const mounted = mountCard({
    post: { id: "post-01", content: "" },
  });

  try {
    assert.match(mounted.root.textContent, /Unknown user/);
    assert.match(mounted.root.textContent, /Like \(0\)/);
  } finally {
    mounted.unmount();
  }
});

test("a card the shopper already liked shows Liked and the count", () => {
  const mounted = mountCard({
    post: {
      id: "post-02",
      content: "Hello",
      likes: 4,
      likedByCurrentUser: true,
      author: { id: "author-01", fullName: "Ada" },
    },
    currentUserId: "user-02",
  });

  try {
    assert.match(mounted.root.textContent, /Ada/);
    assert.match(mounted.root.textContent, /Liked \(4\)/);
  } finally {
    mounted.unmount();
  }
});

test("a guest like button is disabled", () => {
  const mounted = mountCard({
    post: {
      id: "post-03",
      content: "Hello",
      likes: 1,
      author: { id: "author-01", fullName: "Ada" },
    },
  });

  try {
    const likeButton = findLikeButton(mounted.root);
    assert.equal(likeButton.disabled, true);
    assert.equal(likeButton.getAttribute("title"), "Sign in to like posts");
  } finally {
    mounted.unmount();
  }
});

test("the author's own like button is disabled", () => {
  const mounted = mountCard({
    post: {
      id: "post-04",
      content: "Hello",
      likes: 1,
      author: { id: "author-01", fullName: "Ada" },
    },
    currentUserId: "author-01",
  });

  try {
    const likeButton = findLikeButton(mounted.root);
    assert.equal(likeButton.disabled, true);
    assert.equal(likeButton.getAttribute("title"), "You cannot like your own post");
  } finally {
    mounted.unmount();
  }
});

/**
 * Finds the first element in a mounted card that has a class.
 *
 * @param {object} root - Mounted card root.
 * @param {string} className - Class to look for.
 * @returns {object | null} The element.
 */
function findByClass(root, className) {
  return findElement(root, (node) => node.classList && node.classList.contains(className));
}

test("a card with no date shows no date, and an invalid date shows the raw value", () => {
  const undated = mountCard({ post: { id: "post-05", content: "Hello" } });
  try {
    assert.equal(findByClass(undated.root, "post-card-date").textContent, "");
  } finally {
    undated.unmount();
  }

  const invalid = mountCard({ post: { id: "post-06", content: "Hello", createdAt: "not-a-date" } });
  try {
    assert.equal(findByClass(invalid.root, "post-card-date").textContent, "not-a-date");
  } finally {
    invalid.unmount();
  }
});

test("clicking the author does not open the post, and clicking the card does", async () => {
  const post = {
    id: "post-07",
    content: "Hello",
    author: { id: "author-01", username: "ada", fullName: "Ada" },
  };
  const openedPosts = [];
  const mounted = mountCard({
    post,
    onPostClick(clickedPost) {
      openedPosts.push(clickedPost);
    },
    onAuthorClick() {},
  });

  try {
    await act(async () => {
      findByClass(mounted.root, "post-card-author-button").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });
    assert.deepEqual(openedPosts, []);

    await act(async () => {
      findByClass(mounted.root, "post-card-content").dispatchEvent(
        new MouseEvent("click", { bubbles: true }),
      );
    });
    assert.deepEqual(openedPosts, [post]);
  } finally {
    mounted.unmount();
  }
});
