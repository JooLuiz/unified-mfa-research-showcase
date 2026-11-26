/**
 * Verifies the shipping address form a shopper fills in.
 * Role: Locks empty and prefilled fields, typing into a field, and clearing the mount on unmount.
 * Not in this file: Where a submitted address goes, which is the host's channel.
 * Key dependencies: node:test; vue; src/account-address.js; test/support/installDomDocument.js.
 * See also: src/account-address.js; src/account-profile.test.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import "../../../test/support/installBrowserGlobals.js";
import { findElement, installDomDocument } from "../../../test/support/installDomDocument.js";
import { loadAppModule } from "../../../test/support/loadAppModule.js";

installDomDocument();
const { nextTick } = await import("vue");
const { mountAccountAddress } = await loadAppModule(new URL("./account-address.js", import.meta.url).href);

const FIELD_IDS = ["streetInput", "cityInput", "stateInput", "postalCodeInput", "countryInput"];

/**
 * Reads every address input value by id.
 *
 * @param {object} root - Mount root.
 * @returns {string[]} Values in form order.
 */
function readFields(root) {
  return FIELD_IDS.map((fieldId) => String(findElement(root, (node) => node.id === fieldId).value));
}

test("no saved address shows five empty fields", async () => {
  const { root } = installDomDocument();
  const unmount = mountAccountAddress(root, {});
  try {
    assert.match(root.textContent, /Shipping Address/);
    assert.deepEqual(readFields(root), ["", "", "", "", ""]);
  } finally {
    unmount();
  }
  assert.equal(root.textContent, "");
});

test("a saved address prefills the fields, and typing updates one field", async () => {
  const { root } = installDomDocument();
  const unmount = mountAccountAddress(root, {
    address: { street: "1 Main St", city: "London", state: "LDN", postalCode: "N1", country: "UK" },
  });
  try {
    assert.deepEqual(readFields(root), ["1 Main St", "London", "LDN", "N1", "UK"]);

    const cityInput = findElement(root, (node) => node.id === "cityInput");
    cityInput.value = "Leeds";
    cityInput.dispatchEvent(new MouseEvent("input", { bubbles: true }));
    await nextTick();
    assert.equal(String(findElement(root, (node) => node.id === "cityInput").value), "Leeds");
  } finally {
    unmount();
  }
});

test("a partial address leaves the missing fields empty", async () => {
  const { root } = installDomDocument();
  const unmount = mountAccountAddress(root, { address: { city: "Paris" } });
  try {
    assert.deepEqual(readFields(root), ["", "Paris", "", "", ""]);
  } finally {
    unmount();
  }
});
