/**
 * Verifies stored auth and the post-login redirect the shopper can read back.
 * Role: Locks the session storage outcomes shared by both comparison branches.
 * Not in this file: Login requests.
 * Key dependencies: node:test; src/notifications/sessionState.js; test/support/installBrowserGlobals.js.
 * See also: src/notifications/sessionState.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import "../../../../test/support/installBrowserGlobals.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

const { AUTH_TOKEN_STORAGE_KEY, AUTH_USER_STORAGE_KEY } = await loadAppModule(
  new URL("../utils/constants.js", import.meta.url).href,
);
const {
  readStoredAuthRecord,
  storePostLoginRedirect,
  takePostLoginRedirect,
  writeStoredAuthRecord,
} = await loadAppModule(new URL("./sessionState.js", import.meta.url).href);

test("a stored shopper is read back, and a broken user record signs nobody in", () => {
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    writeStoredAuthRecord("token-01", { id: "user-01", fullName: "Ada" });
    const stored = readStoredAuthRecord();
    assert.equal(stored.token, "token-01");
    assert.equal(stored.user.fullName, "Ada");

    localStorage.setItem(AUTH_USER_STORAGE_KEY, "{not-json");
    assert.equal(readStoredAuthRecord(), null);

    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, "token-01");
    localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    assert.equal(readStoredAuthRecord(), null);

    writeStoredAuthRecord(null, null);
    assert.equal(readStoredAuthRecord(), null);
  } finally {
    console.warn = originalWarn;
    writeStoredAuthRecord(null, null);
  }
});

test("an empty post-login redirect is ignored, and a saved path is returned once", () => {
  storePostLoginRedirect("");
  assert.equal(takePostLoginRedirect(), null);

  storePostLoginRedirect("/orders/order-01");
  assert.equal(takePostLoginRedirect(), "/orders/order-01");
  assert.equal(takePostLoginRedirect(), null);
});
