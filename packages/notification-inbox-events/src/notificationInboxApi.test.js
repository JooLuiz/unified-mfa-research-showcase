/**
 * Verifies the shared inbox read.
 * Role: Locks the skipped call, the failed call, and both shapes of a successful body.
 * Not in this file: Mark-read writes. Those are not the same export on every branch.
 * Key dependencies: node:test; src/notificationInboxApi.js.
 * See also: src/notificationInboxApi.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { fetchNotificationInbox } from "./notificationInboxApi.js";

const API_BASE_URL = "http://localhost:4000/api";

/**
 * Installs one fetch result and restores the previous fetch.
 *
 * @param {{ ok: boolean, status?: number, statusText?: string, json?: () => Promise<object> }} response - Scripted HTTP result.
 * @returns {() => void} Restores the previous fetch.
 */
function installFetch(response) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => response;
  return function restoreFetch() {
    globalThis.fetch = originalFetch;
  };
}

test("fetchNotificationInbox returns no rows when the base url, token, or shell is missing", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("fetchNotificationInbox called fetch");
  };

  try {
    const skippedReads = [
      await fetchNotificationInbox({ apiBaseUrl: "", authToken: "token-01", shell: "ecommerce" }),
      await fetchNotificationInbox({ apiBaseUrl: API_BASE_URL, authToken: "", shell: "ecommerce" }),
      await fetchNotificationInbox({ apiBaseUrl: API_BASE_URL, authToken: "token-01", shell: "" }),
    ];
    assert.deepEqual(skippedReads, [[], [], []]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("fetchNotificationInbox throws when the server rejects the read", async () => {
  const restoreFetch = installFetch({
    ok: false,
    status: 503,
    statusText: "Service Unavailable",
  });

  try {
    await assert.rejects(
      () =>
        fetchNotificationInbox({
          apiBaseUrl: API_BASE_URL,
          authToken: "token-01",
          shell: "ecommerce",
        }),
      /fetchNotificationInbox - request failed: 503 Service Unavailable/,
    );
  } finally {
    restoreFetch();
  }
});

test("fetchNotificationInbox returns the item list", async () => {
  const items = [{ id: "n-01", read: false }];
  const restoreFetch = installFetch({
    ok: true,
    json: async () => ({ items }),
  });

  try {
    const rows = await fetchNotificationInbox({
      apiBaseUrl: API_BASE_URL,
      authToken: "token-01",
      shell: "ecommerce",
    });
    assert.deepEqual(rows, items);
  } finally {
    restoreFetch();
  }
});

test("fetchNotificationInbox returns no rows when the body has no item list", async () => {
  const restoreFetch = installFetch({
    ok: true,
    json: async () => ({ items: null }),
  });

  try {
    const rows = await fetchNotificationInbox({
      apiBaseUrl: API_BASE_URL,
      authToken: "token-01",
      shell: "social",
    });
    assert.deepEqual(rows, []);
  } finally {
    restoreFetch();
  }
});
