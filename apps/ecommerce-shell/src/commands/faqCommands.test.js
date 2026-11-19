/**
 * Verifies FAQ answers are sent with the signed-in token and a failed send stays quiet.
 * Role: Locks the token header and the failure outcome of persistFaqAnswerToApi.
 * Not in this file: The FAQ form.
 * Key dependencies: node:test; src/commands/faqCommands.js; test/support/loadAppModule.js.
 * See also: src/commands/faqCommands.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import "../../../../test/support/installBrowserGlobals.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

const { persistFaqAnswerToApi } = await loadAppModule(
  new URL("./faqCommands.js", import.meta.url).href,
);

test("a signed-in FAQ answer is sent with that token, and a failed send resolves", async () => {
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  console.warn = () => {};
  const seenHeaders = [];
  globalThis.fetch = async (_url, options) => {
    seenHeaders.push(options.headers);
    if (seenHeaders.length === 1) {
      return { ok: true, json: async () => ({ id: "faq-01" }) };
    }
    throw new Error("offline");
  };

  try {
    await persistFaqAnswerToApi(
      { authToken: "token-01" },
      { name: "Ada", email: "ada@example.com", question: "Where is my order?" },
    );
    await persistFaqAnswerToApi({ authToken: "" }, { name: "Ada", email: "ada@example.com", question: "Again" });
    assert.equal(seenHeaders[0].Authorization, "Bearer token-01");
    assert.equal(seenHeaders[1].Authorization, undefined);
  } finally {
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
  }
});
