/**
 * Verifies the ecommerce-shell JSON request helper.
 * Role: Locks the parsed body on success and the rejection a caller sees on a failed response.
 * Not in this file: What the pages render from the body.
 * Key dependencies: node:test; src/utils/requestJson.js; test/support/loadAppModule.js.
 * See also: src/utils/requestJson.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import "../../../../test/support/installBrowserGlobals.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

const { default: requestJson } = await loadAppModule(
  new URL("./requestJson.js", import.meta.url).href,
);

/**
 * Replaces fetch with one fixed response for the duration of a test.
 *
 * @param {{ ok: boolean, status: number, statusText: string, body?: unknown }} response - Response to return.
 * @returns {{ requests: Array<{ url: string, options: object }>, restore: () => void }} Recorded requests and a restore function.
 */
function stubFetch({ ok, status, statusText, body }) {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    return { ok, status, statusText, json: async () => body };
  };
  return {
    requests,
    restore() {
      globalThis.fetch = originalFetch;
    },
  };
}

test("an OK response resolves to the parsed body and keeps the caller's options", async () => {
  const fetchStub = stubFetch({ ok: true, status: 200, statusText: "OK", body: { items: [1] } });
  try {
    const options = { headers: { Authorization: "Bearer token-01" } };
    assert.deepEqual(await requestJson("/orders", options), { items: [1] });
    assert.deepEqual(fetchStub.requests, [{ url: "/orders", options }]);
  } finally {
    fetchStub.restore();
  }
});

test("a server error rejects with its status", async () => {
  const fetchStub = stubFetch({ ok: false, status: 500, statusText: "Server Error" });
  try {
    await assert.rejects(requestJson("/orders"), /Request failed: 500 Server Error/);
  } finally {
    fetchStub.restore();
  }
});

test("a 401 rejects with or without an Authorization header", async () => {
  const fetchStub = stubFetch({ ok: false, status: 401, statusText: "Unauthorized" });
  try {
    await assert.rejects(
      requestJson("/orders", { headers: { Authorization: "Bearer expired" } }),
      /Request failed: 401 Unauthorized/,
    );
    await assert.rejects(requestJson("/orders", { headers: {} }), /Request failed: 401 Unauthorized/);
  } finally {
    fetchStub.restore();
  }
});
