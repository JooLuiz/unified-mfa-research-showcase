/**
 * Verifies the promotional banner a shopper sees for a missing, failed, or loaded banner.
 * Role: Locks the empty-banner copy and the loaded title shared by both comparison branches.
 * Not in this file: Applying the promotion (each branch routes it differently).
 * Key dependencies: node:test; src/promotional-banner.js; test/support/installDomDocument.js.
 * See also: src/promotional-banner.js.
 */

import assert from "node:assert/strict";
import { register } from "node:module";
import test from "node:test";
import { act } from "react";
import "../../../test/support/installBrowserGlobals.js";
import { installDomDocument } from "../../../test/support/installDomDocument.js";
import { loadAppModule } from "../../../test/support/loadAppModule.js";

const jsxLoader = register(new URL("../../../scripts/test/jsxLoader.mjs", import.meta.url), import.meta.url);
if (jsxLoader && typeof jsxLoader.then === "function") {
  await jsxLoader;
}

const { mountPromotionalBanner } = await loadAppModule(
  new URL("./promotional-banner.js", import.meta.url).href,
);

const API_BASE_URL = "http://localhost:4000";

/**
 * Mounts the banner and lets its request settle.
 *
 * @param {object} props - Banner props.
 * @returns {Promise<{ root: object, unmount: () => void }>} Mounted banner.
 */
async function mountBanner(props) {
  const { root } = installDomDocument();
  let unmountBanner = () => {};
  await act(async () => {
    unmountBanner = mountPromotionalBanner(root, props);
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  return {
    root,
    unmount() {
      act(() => {
        unmountBanner();
      });
    },
  };
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

test("a missing banner id shows no banner and sends no request", async () => {
  let fetchCalls = 0;
  await withFetch(async () => {
    fetchCalls += 1;
    throw new Error("fetch should not run");
  }, async () => {
    const mounted = await mountBanner({ apiBaseUrl: API_BASE_URL });
    try {
      assert.equal(mounted.root.textContent, "No banner available.");
      assert.equal(fetchCalls, 0);
    } finally {
      mounted.unmount();
    }
  });
});

test("a failed banner request shows no banner", async () => {
  const requestedUrls = [];
  await withFetch(async (url) => {
    requestedUrls.push(String(url));
    return { ok: false, status: 404, statusText: "Not Found", json: async () => ({}) };
  }, async () => {
    const mounted = await mountBanner({ apiBaseUrl: API_BASE_URL, bannerId: "b-1" });
    try {
      assert.equal(mounted.root.textContent, "No banner available.");
      assert.match(requestedUrls[0], /\/banners\/b-1$/);
    } finally {
      mounted.unmount();
    }
  });
});

test("a loaded banner shows its title and the promotion button", async () => {
  await withFetch(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ title: "Spring Sale", imageUrl: "spring.png" }),
  }), async () => {
    const mounted = await mountBanner({ apiBaseUrl: API_BASE_URL, bannerId: "b-1" });
    try {
      assert.match(mounted.root.textContent, /Spring Sale/);
      assert.match(mounted.root.textContent, /View Promotion/);
    } finally {
      mounted.unmount();
    }
  });
});
