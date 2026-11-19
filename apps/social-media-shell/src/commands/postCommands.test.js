/**
 * Verifies a new post is kept, and a signed-out or failed publish leaves the feed unchanged.
 * Role: Locks the outcomes of persistNewPost.
 * Not in this file: The new-post form.
 * Key dependencies: node:test; src/commands/postCommands.js; test/support/loadAppModule.js.
 * See also: src/commands/postCommands.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import "../../../../test/support/installBrowserGlobals.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

const { persistNewPost } = await loadAppModule(new URL("./postCommands.js", import.meta.url).href);

test("a signed-out publish leaves the feed unchanged, and a saved post is kept once", async () => {
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  console.warn = () => {};
  const appState = { authToken: "", posts: [{ id: "post-01", content: "Existing" }] };

  try {
    const signedOut = await persistNewPost(appState, { content: "New" });
    assert.deepEqual(signedOut, { ok: false });
    assert.equal(appState.posts.length, 1);

    appState.authToken = "token-01";
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ id: "post-02", content: "New" }),
    });
    const saved = await persistNewPost(appState, { content: "New" });
    assert.equal(saved.ok, true);
    assert.equal(appState.posts[0].id, "post-02");

    const duplicate = await persistNewPost(appState, { content: "New" });
    assert.equal(duplicate.ok, true);
    assert.equal(appState.posts.filter((post) => post.id === "post-02").length, 1);

    globalThis.fetch = async () => {
      throw new Error("offline");
    };
    const failed = await persistNewPost(appState, { content: "Later" });
    assert.deepEqual(failed, { ok: false });
    assert.equal(appState.posts.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
  }
});
