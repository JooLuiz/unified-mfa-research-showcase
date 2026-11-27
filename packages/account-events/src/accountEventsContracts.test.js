/**
 * Verifies the account profile and address validators and normalisers.
 * Role: Locks which save requests the shell accepts and how they are cleaned, on every comparison branch.
 * Not in this file: Publishing or listening (src/createAccountIntentApi.test.js).
 * Key dependencies: node:test; src/accountEventsContracts.js.
 * See also: src/accountEventsContracts.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  createAddressSaveRequest,
  createProfileSaveRequest,
  isValidAddressSaveRequest,
  isValidProfileSaveRequest,
} from "./accountEventsContracts.js";

const ADDRESS = {
  street: " 1 Main St ",
  city: " Lisbon",
  state: "LX ",
  postalCode: " 1000-001 ",
  country: " PT ",
};

test("a profile needs a string name and gender", () => {
  assert.equal(isValidProfileSaveRequest({ fullName: "", gender: "" }), true);
  [
    null,
    "Ada",
    {},
    { fullName: "Ada" },
    { fullName: "Ada", gender: 1 },
    { fullName: 1, gender: "female" },
  ].forEach((candidate) => {
    assert.equal(isValidProfileSaveRequest(candidate), false, String(JSON.stringify(candidate)));
  });
});

test("a valid profile is trimmed, and an invalid one becomes null", () => {
  assert.deepEqual(
    createProfileSaveRequest({ fullName: " Ada Lovelace ", gender: " female ", role: "admin" }),
    { fullName: "Ada Lovelace", gender: "female" },
  );
  assert.equal(createProfileSaveRequest({ fullName: "Ada" }), null);
});

test("an address needs every field as a string", () => {
  assert.equal(isValidAddressSaveRequest(ADDRESS), true);
  assert.equal(isValidAddressSaveRequest(null), false);
  assert.equal(isValidAddressSaveRequest("1 Main St"), false);
  Object.keys(ADDRESS).forEach((field) => {
    assert.equal(isValidAddressSaveRequest({ ...ADDRESS, [field]: 7 }), false, field);
  });
});

test("a valid address is trimmed, and an invalid one becomes null", () => {
  assert.deepEqual(createAddressSaveRequest({ ...ADDRESS, notes: "gate" }), {
    street: "1 Main St",
    city: "Lisbon",
    state: "LX",
    postalCode: "1000-001",
    country: "PT",
  });
  assert.equal(createAddressSaveRequest({ ...ADDRESS, city: null }), null);
});
