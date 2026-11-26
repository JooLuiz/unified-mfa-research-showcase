/**
 * Verifies the profile form a member sees and edits.
 * Role: Locks unknown-user labels, prefilled values, the avatar, editing, and clearing the mount on unmount.
 * Not in this file: Where a submitted profile goes, which is the host's channel.
 * Key dependencies: node:test; vue; src/account-profile.js; test/support/installDomDocument.js.
 * See also: src/account-profile.js; src/account-address.test.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import "../../../test/support/installBrowserGlobals.js";
import { findElement, installDomDocument } from "../../../test/support/installDomDocument.js";
import { loadAppModule } from "../../../test/support/loadAppModule.js";

installDomDocument();
const { nextTick } = await import("vue");
const { mountAccountProfile } = await loadAppModule(new URL("./account-profile.js", import.meta.url).href);

/**
 * Finds an element by id.
 *
 * @param {object} root - Mount root.
 * @param {string} id - Element id.
 * @returns {object | null} The element.
 */
function byId(root, id) {
  return findElement(root, (node) => node.id === id);
}

test("no user shows unknown labels, an empty name, and no avatar", async () => {
  const { root } = installDomDocument();
  const unmount = mountAccountProfile(root, {});
  try {
    assert.match(root.textContent, /Username: \(unknown\)/);
    assert.match(root.textContent, /Email: \(unknown\)/);
    assert.equal(String(byId(root, "fullNameInput").value), "");
    assert.equal(findElement(root, (node) => node.nodeName === "IMG"), null);
  } finally {
    unmount();
  }
  assert.equal(root.textContent, "");
});

test("a user shows their details and avatar, and the form keeps edits", async () => {
  const { root } = installDomDocument();
  const unmount = mountAccountProfile(root, {
    user: {
      username: "ada",
      email: "ada@example.com",
      fullName: "Ada Lovelace",
      gender: "female",
      avatarUrl: "ada.png",
    },
  });
  try {
    assert.match(root.textContent, /Username: ada/);
    assert.match(root.textContent, /Email: ada@example\.com/);
    assert.equal(findElement(root, (node) => node.nodeName === "IMG").getAttribute("src"), "ada.png");
    assert.equal(String(byId(root, "fullNameInput").value), "Ada Lovelace");

    const nameInput = byId(root, "fullNameInput");
    nameInput.value = "Ada King";
    nameInput.dispatchEvent(new MouseEvent("input", { bubbles: true }));
    const genderSelect = byId(root, "genderInput");
    genderSelect.value = "other";
    genderSelect.dispatchEvent(new MouseEvent("change", { bubbles: true }));
    await nextTick();
    assert.equal(String(byId(root, "fullNameInput").value), "Ada King");
    assert.equal(String(byId(root, "genderInput").value), "other");
  } finally {
    unmount();
  }
});
