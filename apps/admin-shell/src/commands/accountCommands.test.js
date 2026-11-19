/**
 * Verifies an account update without a session is declined.
 * Role: Locks the signed-out outcome of the admin shell account command.
 * Not in this file: The account form.
 * Key dependencies: node:test; src/commands/accountCommands.js; test/support/loadAppModule.js.
 * See also: src/commands/accountCommands.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import "../../../../test/support/installBrowserGlobals.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

const { persistAccountUpdate } = await loadAppModule(
  new URL("./accountCommands.js", import.meta.url).href,
);

test("an account update without a session is declined", async () => {
  const appState = { authToken: undefined, currentUser: null };
  const result = await persistAccountUpdate(appState, { fullName: "Ada Lovelace" });

  assert.deepEqual(result, { ok: false });
  assert.equal(appState.currentUser, null);
});

test("a saved profile replaces the signed-in admin, and a rejected save keeps the previous user", async () => {
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  console.warn = () => {};
  const appState = {
    authToken: "token-01",
    currentUser: { id: "admin-01", role: "admin", fullName: "Ada Lovelace" },
  };

  try {
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ id: "admin-01", role: "admin", fullName: "Ada Byron", address: { city: "London" } }),
    });
    const profile = await persistAccountUpdate(appState, { fullName: "Ada Byron" });
    assert.equal(profile.ok, true);
    assert.equal(appState.currentUser.fullName, "Ada Byron");

    const address = await persistAccountUpdate(appState, { address: { city: "London" } });
    assert.equal(address.ok, true);
    assert.equal(appState.currentUser.address.city, "London");

    globalThis.fetch = async () => {
      throw new Error("offline");
    };
    const failed = await persistAccountUpdate(appState, { fullName: "Someone Else" });
    assert.deepEqual(failed, { ok: false });
    assert.equal(appState.currentUser.fullName, "Ada Byron");
  } finally {
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
  }
});
