/**
 * Verifies the single-post view message a shopper sees when the post cannot be requested or loaded.
 * Role: Locks the missing-post copy shared by both comparison branches.
 * Not in this file: A successful post render and the card like control.
 * Key dependencies: node:test; src/SinglePostView.js; test/support/installDomDocument.js.
 * See also: src/SinglePostView.js; src/SinglePostCard.test.js.
 */

import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import "../../../test/support/installBrowserGlobals.js";
import { installDomDocument } from "../../../test/support/installDomDocument.js";
import { loadAppModule } from "../../../test/support/loadAppModule.js";

const jsxLoader = register(new URL("../../../scripts/test/jsxLoader.mjs", import.meta.url), import.meta.url);
if (jsxLoader && typeof jsxLoader.then === "function") {
  await jsxLoader;
}

const { SinglePostView } = await loadAppModule(
  new URL("./SinglePostView.js", import.meta.url).href,
);

/**
 * Mounts the single-post view and waits for the skipped request to settle.
 *
 * @param {object} props - View props. A missing base URL or post id skips the request.
 * @returns {Promise<{ root: object, unmount: () => void }>} Mounted view.
 */
async function mountView(props) {
  const { root } = installDomDocument();
  const reactRoot = createRoot(root);
  await act(async () => {
    reactRoot.render(createElement(SinglePostView, props));
    await Promise.resolve();
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

test("a view with no api base url shows post not found", async () => {
  const mounted = await mountView({ postId: "post-01" });

  try {
    assert.match(mounted.root.textContent, /Post not found\./);
  } finally {
    mounted.unmount();
  }
});

test("a view with no post id shows post not found", async () => {
  const mounted = await mountView({
    apiBaseUrl: "http://localhost:4000",
    postId: "",
  });

  try {
    assert.match(mounted.root.textContent, /Post not found\./);
  } finally {
    mounted.unmount();
  }
});

/**
 * Lets pending fetch promises and the state updates they trigger settle.
 *
 * @returns {Promise<void>}
 */
async function flushRequests() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/**
 * Replaces fetch for one test and restores it afterwards.
 *
 * @param {(url: string) => Promise<object>} fetchStub - Stand-in fetch.
 * @param {() => Promise<void>} run - Test body.
 * @returns {Promise<void>}
 */
async function withFetch(fetchStub, run) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchStub;
  try {
    await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test("a non-OK post response shows the failed status", async () => {
  const requestedUrls = [];
  await withFetch(async (url) => {
    requestedUrls.push(String(url));
    return { ok: false, status: 404, json: async () => ({}) };
  }, async () => {
    const mounted = await mountView({ apiBaseUrl: "http://localhost:4000", postId: "post-01" });
    try {
      await flushRequests();
      assert.match(mounted.root.textContent, /Failed to load post: 404/);
      assert.match(requestedUrls[0], /\/posts\/post-01$/);
    } finally {
      mounted.unmount();
    }
  });
});

test("a rejected post request with no message shows Failed to load post", async () => {
  await withFetch(async () => {
    throw new Error("");
  }, async () => {
    const mounted = await mountView({ apiBaseUrl: "http://localhost:4000", postId: "post-01" });
    try {
      await flushRequests();
      assert.equal(mounted.root.textContent, "Failed to load post");
    } finally {
      mounted.unmount();
    }
  });
});

test("unmounting before the post arrives leaves the page empty", async () => {
  let resolvePost = () => {};
  await withFetch(
    () =>
      new Promise((resolve) => {
        resolvePost = () => resolve({ ok: true, status: 200, json: async () => ({ id: "post-01", content: "Late" }) });
      }),
    async () => {
      const mounted = await mountView({ apiBaseUrl: "http://localhost:4000", postId: "post-01" });
      mounted.unmount();
      resolvePost();
      await flushRequests();
      assert.equal(mounted.root.textContent, "");
    },
  );
});
