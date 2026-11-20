/**
 * Verifies the single-post card text and disabled like button a shopper can see.
 * Role: Locks author fallback, like counts, and disabled likes shared by both comparison branches.
 * Not in this file: The like write, live like delivery, and post loading.
 * Key dependencies: node:test; src/SinglePostCard.js; test/support/installDomDocument.js.
 * See also: src/SinglePostCard.js; src/SinglePostView.test.js.
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

const { SinglePostCard } = await loadAppModule(
  new URL("./SinglePostCard.js", import.meta.url).href,
);

/**
 * Mounts one single-post card.
 *
 * @param {object} props - Card props. The like button stays unclicked.
 * @returns {{ root: object, unmount: () => void }} Mounted card.
 */
function mountCard(props) {
  const { root } = installDomDocument();
  const reactRoot = createRoot(root);
  act(() => {
    reactRoot.render(createElement(SinglePostCard, props));
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
    (node) => node.classList && node.classList.contains("single-post-like-button"),
  );
}

test("a card with no author and no likes shows the fallback name and a zero count", () => {
  const mounted = mountCard({
    post: { id: "post-01", content: "" },
  });

  try {
    assert.match(mounted.root.textContent, /Unknown Author/);
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
    assert.equal(findLikeButton(mounted.root).disabled, true);
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
    assert.equal(findLikeButton(mounted.root).disabled, true);
  } finally {
    mounted.unmount();
  }
});

test("a like button is disabled when this host does not allow likes", () => {
  const mounted = mountCard({
    post: {
      id: "post-05",
      content: "Hello",
      likes: 2,
      author: { id: "author-01", fullName: "Ada" },
    },
    currentUserId: "user-02",
    canLike: false,
  });

  try {
    assert.equal(findLikeButton(mounted.root).disabled, true);
  } finally {
    mounted.unmount();
  }
});
