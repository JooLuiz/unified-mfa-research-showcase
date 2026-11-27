/**
 * Verifies the signed-in user's profile and address save requests send the right account update.
 * Role: Locks each account request outcome on every comparison branch.
 * Not in this file: How a request reaches the shell, or the update HTTP call and its toasts
 *   (src/commands/accountCommands.test.js).
 * Key dependencies: node:test; src/intents/accountIntentHandlers.js;
 *   test/support/createRecordingTransport.js; test/support/loadAppModule.js.
 * See also: src/intents/accountIntentHandlers.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createRecordingTransport } from "../../../../test/support/createRecordingTransport.js";
import "../../../../test/support/installBrowserGlobals.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

const { createAccountIntentHandlers } = await loadAppModule(
  new URL("./accountIntentHandlers.js", import.meta.url).href,
);

const ADDRESS = {
  street: "1 Main St",
  city: "Lisbon",
  state: "LX",
  postalCode: "1000",
  country: "PT",
};

/**
 * Builds handlers whose account updates are recorded.
 *
 * @returns {{ appState: object, handlers: object, transport: object, updates: object[] }}
 */
function createRecordedAccount() {
  const appState = { authToken: "token-01", currentUser: { id: "user-01" } };
  const transport = createRecordingTransport();
  const updates = [];
  const handlers = createAccountIntentHandlers(appState, {
    getTransport: () => transport,
    persist: async (updateTransport, updateState, update) => {
      updates.push({ updateTransport, updateState, update });
      return { ok: true };
    },
  });
  return { appState, handlers, transport, updates };
}

test("a profile save sends the profile fields as the account update", async () => {
  const { appState, handlers, transport, updates } = createRecordedAccount();
  const profile = { fullName: "Ada Lovelace", gender: "female" };

  const outcome = await handlers.onProfileSaveRequested(profile);

  assert.deepEqual(outcome, { ok: true });
  assert.deepEqual(updates, [{ updateTransport: transport, updateState: appState, update: profile }]);
});

test("an address save sends the address under its own key", async () => {
  const { handlers, updates } = createRecordedAccount();

  await handlers.onAddressSaveRequested(ADDRESS);

  assert.deepEqual(
    updates.map(({ update }) => update),
    [{ address: ADDRESS }],
  );
});

test("by default a guest's save is declined without a request", async () => {
  const handlers = createAccountIntentHandlers({ authToken: null, currentUser: null });

  assert.deepEqual(await handlers.onProfileSaveRequested({ fullName: "Ada", gender: "female" }), {
    ok: false,
  });
  assert.deepEqual(await handlers.onAddressSaveRequested(ADDRESS), { ok: false });
});
