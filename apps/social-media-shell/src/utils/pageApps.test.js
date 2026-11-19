/**
 * Verifies a page unmount still clears the page when one cleanup throws.
 * Role: Locks the unmount outcome of the social page lifecycle.
 * Not in this file: The real remote micro frontends.
 * Key dependencies: node:test; src/utils/pageApps.js; scripts/test/federatedRemoteResolver.mjs.
 * See also: src/utils/pageApps.js.
 */

import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";
import "../../../../test/support/installBrowserGlobals.js";

const federatedRegistration = register(
  "../../../../scripts/test/federatedRemoteResolver.mjs",
  import.meta.url,
);
if (federatedRegistration && typeof federatedRegistration.then === "function") {
  await federatedRegistration;
}

const { loadAppModule } = await import("../../../../test/support/loadAppModule.js");
const { notificationsPageApp, singlePostPageApp } = await loadAppModule(
  new URL("./pageApps.js", import.meta.url).href,
);

test("unmount clears the page even when a cleanup throws", async () => {
  const originalWarn = console.warn;
  const warnings = [];
  console.warn = (message) => {
    warnings.push(message);
  };
  globalThis.__federatedRemoteCleanup = function failingCleanup() {
    throw new Error("cleanup failed");
  };
  const pageRoot = { innerHTML: "<p>Previous page</p>" };

  try {
    assert.equal(typeof (await notificationsPageApp.bootstrap()), "undefined");
    await notificationsPageApp.mount({
      appState: { authToken: "token-01", currentUser: { id: "u-01" } },
      domElement: pageRoot,
    });
    await notificationsPageApp.unmount();
    assert.equal(pageRoot.innerHTML, "");
    assert.equal(warnings.includes("createPageApp.unmount - cleanupError"), true);

    window.location.pathname = "/feed";
    const feedRoot = { innerHTML: "<p>Feed</p>" };
    await singlePostPageApp.mount({
      appState: { authToken: "", currentUser: null },
      domElement: feedRoot,
    });
    await singlePostPageApp.unmount();
    assert.equal(feedRoot.innerHTML, "");

    window.location.pathname = "/posts/post-99";
    const postRoot = { innerHTML: "<p>Other</p>" };
    await singlePostPageApp.mount({
      appState: { authToken: "token-01", currentUser: { id: "u-01" } },
      domElement: postRoot,
    });
    await singlePostPageApp.unmount();
    assert.equal(postRoot.innerHTML, "");
  } finally {
    console.warn = originalWarn;
    globalThis.__federatedRemoteCleanup = undefined;
  }
});
