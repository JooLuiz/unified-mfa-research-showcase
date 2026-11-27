/**
 * Verifies the account save publishers and the shell's account intent listeners on an injected transport.
 * Role: Locks the profile and address save payloads on every comparison branch.
 * Not in this file: The profile-updated round trip (src/createAccountEvents.test.js) or window names.
 * Key dependencies: node:test; src/createAccountEvents.js; test/support/createRecordingTransport.js.
 * See also: src/createAccountEvents.js; src/accountEventsContracts.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createAccountEvents } from "./createAccountEvents.js";
import { createRecordingTransport } from "../../../test/support/createRecordingTransport.js";

const ADDRESS = {
  street: " 1 Main St ",
  city: "Lisbon",
  state: "LX",
  postalCode: "1000",
  country: "PT",
};

test("profile and address saves are published trimmed, and invalid ones are dropped", () => {
  const transport = createRecordingTransport();
  const accountEvents = createAccountEvents(transport);

  accountEvents.publishProfileSaveRequested({ fullName: " Ada ", gender: " female " });
  accountEvents.publishProfileSaveRequested({ fullName: "Ada" });
  accountEvents.publishAddressSaveRequested(ADDRESS);
  accountEvents.publishAddressSaveRequested({ ...ADDRESS, country: undefined });

  assert.deepEqual(transport.published, [
    {
      topic: "account",
      event: "profile-save-requested",
      payload: { fullName: "Ada", gender: "female" },
      scope: "local",
    },
    {
      topic: "account",
      event: "address-save-requested",
      payload: { ...ADDRESS, street: "1 Main St" },
      scope: "local",
    },
  ]);
});

test("each account intent handler receives only valid payloads", () => {
  const transport = createRecordingTransport();
  const accountEvents = createAccountEvents(transport);
  const received = { profiles: [], addresses: [] };
  accountEvents.ensureAccountIntentListeners({
    onProfileSaveRequested: (profile) => received.profiles.push(profile),
    onAddressSaveRequested: (address) => received.addresses.push(address),
  });

  transport.deliver("account", "profile-save-requested", { fullName: "Ada", gender: "female" });
  transport.deliver("account", "profile-save-requested", { fullName: "Ada" });
  transport.deliver("account", "address-save-requested", ADDRESS);
  transport.deliver("account", "address-save-requested", { street: "1 Main St" });

  assert.deepEqual(received, {
    profiles: [{ fullName: "Ada", gender: "female" }],
    addresses: [ADDRESS],
  });
});

test("the listeners register once, again after a reset, and skip a handler left out", () => {
  const transport = createRecordingTransport();
  const accountEvents = createAccountEvents(transport);
  const profiles = [];
  const handlers = { onProfileSaveRequested: (profile) => profiles.push(profile) };

  accountEvents.ensureAccountIntentListeners(handlers);
  accountEvents.ensureAccountIntentListeners(handlers);
  accountEvents.publishProfileSaveRequested({ fullName: "Ada", gender: "female" });
  accountEvents.publishAddressSaveRequested(ADDRESS);
  assert.equal(profiles.length, 1);

  accountEvents.resetAccountIntentListeners();
  accountEvents.ensureAccountIntentListeners(handlers);
  accountEvents.publishProfileSaveRequested({ fullName: "Ada", gender: "female" });
  assert.equal(profiles.length, 3);

  const addresses = [];
  const addressOnlyAccount = createAccountEvents(createRecordingTransport());
  addressOnlyAccount.ensureAccountIntentListeners({
    onAddressSaveRequested: (address) => addresses.push(address),
  });
  addressOnlyAccount.publishProfileSaveRequested({ fullName: "Ada", gender: "female" });
  addressOnlyAccount.publishAddressSaveRequested(ADDRESS);
  assert.equal(addresses.length, 1);
});
