/**
 * Verifies FAQ answers are sent with the signed-in token and a failed send resolves.
 * Role: Locks the request payload and the failure outcome of persistFaqAnswerToApi.
 * Not in this file: The FAQ form.
 * Key dependencies: node:test; src/commands/faqCommands.js; test/support/loadAppModule.js;
 *   test/support/createRecordingTransport.js.
 * See also: src/commands/faqCommands.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import "../../../../test/support/installBrowserGlobals.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";
import { createRecordingTransport } from "../../../../test/support/createRecordingTransport.js";

const { persistFaqAnswerToApi } = await loadAppModule(
  new URL("./faqCommands.js", import.meta.url).href,
);

test("a signed-in FAQ answer is sent with that token, and a failed send resolves", async () => {
  const originalWarn = console.warn;
  console.warn = () => {};
  const transport = createRecordingTransport({
    requestReplies: [{ ok: true }, { ok: false }],
  });
  const answer = { name: "Ada", email: "ada@example.com", question: "Where is my order?" };

  try {
    const sent = await persistFaqAnswerToApi(transport, { authToken: "token-01" }, answer);
    const failed = await persistFaqAnswerToApi(
      transport,
      { authToken: "" },
      { name: "Ada", email: "ada@example.com", question: "Again" },
    );

    assert.deepEqual(sent, { ok: true });
    assert.deepEqual(failed, { ok: false });
    assert.deepEqual(transport.published[0], {
      topic: "faq",
      event: "submit",
      payload: { authToken: "token-01", answer },
    });
    assert.equal(transport.published[1].payload.authToken, "");
  } finally {
    console.warn = originalWarn;
  }
});
