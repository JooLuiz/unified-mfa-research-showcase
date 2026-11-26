/**
 * Verifies an account update without a session or with a malformed profile is declined, and a saved update replaces the user.
 * Role: Locks the outcomes of persistAccountUpdate.
 * Not in this file: The account form.
 * Key dependencies: node:test; src/commands/accountCommands.js; test/support/loadAppModule.js;
 *   test/support/createRecordingTransport.js.
 * See also: src/commands/accountCommands.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import "../../../../test/support/installBrowserGlobals.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";
import { createRecordingTransport } from "../../../../test/support/createRecordingTransport.js";

const { persistAccountUpdate } = await loadAppModule(
  new URL("./accountCommands.js", import.meta.url).href,
);

test("an account update without a session is declined", async () => {
  const transport = createRecordingTransport();
  const appState = { authToken: "", currentUser: null };
  const result = await persistAccountUpdate(transport, appState, { fullName: "Ada Lovelace", gender: "" });

  assert.deepEqual(result, { ok: false });
  assert.equal(appState.currentUser, null);
  assert.equal(transport.published.length, 0);
});

test("a saved profile replaces the signed-in user, and a rejected save keeps the previous user", async () => {
  const transport = createRecordingTransport({
    requestReplies: [
      { ok: true, user: { id: "u-01", fullName: "Ada Byron" } },
      { ok: true, user: { id: "u-01", fullName: "Ada Byron", address: { city: "London" } } },
      { ok: false, code: "network-error" },
    ],
  });
  const appState = {
    authToken: "token-01",
    currentUser: { id: "u-01", fullName: "Ada Lovelace" },
  };

  const profile = await persistAccountUpdate(transport, appState, { fullName: "Ada Byron", gender: "" });
  assert.equal(profile.ok, true);
  assert.equal(appState.currentUser.fullName, "Ada Byron");

  const address = await persistAccountUpdate(transport, appState, { address: { city: "London" } });
  assert.equal(address.ok, true);
  assert.equal(appState.currentUser.address.city, "London");

  const failed = await persistAccountUpdate(transport, appState, { fullName: "Someone Else", gender: "" });
  assert.deepEqual(failed, { ok: false });
  assert.equal(appState.currentUser.fullName, "Ada Byron");

  assert.deepEqual(transport.published[0], {
    topic: "account",
    event: "update",
    payload: { authToken: "token-01", update: { fullName: "Ada Byron", gender: "" } },
  });
  assert.equal(transport.published.length, 3);
});

test("a malformed profile update is not sent", async () => {
  const transport = createRecordingTransport();
  const appState = { authToken: "token-01", currentUser: { id: "u-01", fullName: "Ada Lovelace" } };

  const missingGender = await persistAccountUpdate(transport, appState, { fullName: "Ada Byron" });
  const numericName = await persistAccountUpdate(transport, appState, { fullName: 7, gender: "" });

  assert.deepEqual(missingGender, { ok: false });
  assert.deepEqual(numericName, { ok: false });
  assert.equal(appState.currentUser.fullName, "Ada Lovelace");
  assert.equal(transport.published.length, 0);
});
