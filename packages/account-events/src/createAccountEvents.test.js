/**
 * Verifies the account profile-save-requested message on an injected transport.
 * Role: Locks topic, event, payload, and scope for createAccountEvents.
 * Not in this file: Profile forms or auth storage.
 * Key dependencies: node:test; src/createAccountEvents.js; test/support/createRecordingTransport.js.
 * See also: src/createAccountEvents.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createAccountEvents } from "./createAccountEvents.js";
import { createRecordingTransport } from "../../../test/support/createRecordingTransport.js";

test("publishProfileUpdated emits a local account message until unsubscribe", () => {
  const transport = createRecordingTransport();
  const accountEvents = createAccountEvents(transport);
  const received = [];
  const unsubscribe = accountEvents.subscribeToProfileUpdates((payload) => {
    received.push(payload);
  });
  const profile = { fullName: "Bruno Navarro" };

  accountEvents.publishProfileUpdated(profile);
  unsubscribe();
  accountEvents.publishProfileUpdated({ fullName: "Later" });

  assert.deepEqual(transport.published, [
    { topic: "account", event: "profile-save-requested", payload: profile, scope: "local" },
    { topic: "account", event: "profile-save-requested", payload: { fullName: "Later" }, scope: "local" },
  ]);
  assert.deepEqual(received, [profile]);
});
