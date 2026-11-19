/**
 * Verifies moving from one post to another requests a fresh render.
 * Role: Locks the address and the remount outcome of social navigate.
 * Not in this file: The post page itself.
 * Key dependencies: node:test; src/utils/navigate.js; test/support/loadAppModule.js.
 * See also: src/utils/navigate.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import "../../../../test/support/installBrowserGlobals.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

/**
 * Builds an anchor whose href assignment fills the URL parts single-spa reads.
 *
 * @returns {object} Anchor stand-in.
 */
function createAnchor() {
  const anchor = { tagName: "a" };
  Object.defineProperty(anchor, "href", {
    set(value) {
      const nextUrl = new URL(value, "http://localhost");
      anchor.host = nextUrl.host;
      anchor.pathname = nextUrl.pathname;
      anchor.search = nextUrl.search;
      anchor.hash = nextUrl.hash;
    },
    get() {
      return `http://${anchor.host || "localhost"}${anchor.pathname || "/"}${anchor.search || ""}${anchor.hash || ""}`;
    },
  });
  return anchor;
}

globalThis.document = {
  createElement(tagName) {
    return tagName === "a" ? createAnchor() : { tagName };
  },
  body: {
    appendChild() {},
    removeChild() {},
  },
};

const { navigate } = await loadAppModule(new URL("./navigate.js", import.meta.url).href);
const { subscribeToRenderRequests } = await loadAppModule(
  new URL("../events/eventBus.js", import.meta.url).href,
);

test("opening a different post from the current post requests a fresh render", () => {
  const renders = [];
  const unsubscribe = subscribeToRenderRequests(() => {
    renders.push(window.location.pathname);
  });
  window.location.pathname = "/posts/post-01";

  navigate("/posts/post-02");
  assert.equal(window.location.pathname, "/posts/post-02");
  assert.deepEqual(renders, ["/posts/post-02"]);

  navigate("/posts/post-02?liked=1");
  assert.equal(renders.length, 1);

  navigate("/posts");
  assert.equal(window.location.pathname, "/posts");
  assert.equal(renders.length, 1);

  window.location.pathname = "/";
  navigate("/posts/post-03");
  assert.equal(window.location.pathname, "/posts/post-03");
  assert.equal(renders.length, 1);

  navigate("/account");
  assert.equal(window.location.pathname, "/account");
  assert.equal(renders.length, 1);
  unsubscribe();
});
