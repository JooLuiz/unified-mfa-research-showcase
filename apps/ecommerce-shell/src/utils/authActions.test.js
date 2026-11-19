/**
 * Verifies a signed-out session refresh and a rejected refresh leave the shopper signed out.
 * Role: Locks the session outcomes of the ecommerce auth helpers.
 * Not in this file: The login form.
 * Key dependencies: node:test; src/utils/authActions.js; test/support/loadAppModule.js.
 * See also: src/utils/authActions.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import "../../../../test/support/installBrowserGlobals.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";

const {
  consumePostLoginRedirect,
  isAuthenticated,
  isProtectedRoute,
  readStoredAuth,
  refreshCurrentUserFromApi,
  rememberPostLoginRedirect,
  setAuthSession,
} = await loadAppModule(new URL("./authActions.js", import.meta.url).href);

test("a rejected account refresh signs the shopper out, and a failed refresh keeps the previous user", async () => {
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  console.warn = () => {};
  const signedOut = { authToken: "", currentUser: { id: "u-01", fullName: "Bruno" } };
  setAuthSession(signedOut, { token: "", user: null });
  assert.equal(signedOut.authToken, null);
  assert.equal(isAuthenticated(signedOut), false);
  assert.equal(isProtectedRoute("/order-details/order-01"), true);
  assert.equal(isProtectedRoute("/order-details/"), false);
  assert.equal(isProtectedRoute("/products"), false);

  await refreshCurrentUserFromApi(signedOut);
  assert.equal(signedOut.currentUser, null);

  const appState = { authToken: "token-01", currentUser: { id: "u-01", fullName: "Bruno" } };
  globalThis.fetch = async () => ({ ok: false, status: 401, json: async () => ({}) });
  try {
    await refreshCurrentUserFromApi(appState);
    assert.equal(appState.authToken, null);
    assert.equal(isAuthenticated(appState), false);

    appState.authToken = "token-01";
    appState.currentUser = { id: "u-01", fullName: "Bruno" };
    globalThis.fetch = async () => {
      throw new Error("offline");
    };
    await refreshCurrentUserFromApi(appState);
    assert.equal(appState.currentUser.fullName, "Bruno");

    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ id: "u-01", fullName: "Bruno Silva" }),
    });
    await refreshCurrentUserFromApi(appState);
    assert.equal(appState.currentUser.fullName, "Bruno Silva");
    assert.equal(isAuthenticated(appState), true);
    assert.equal(isProtectedRoute("/checkout"), true);

    setAuthSession(appState, { token: "token-01", user: { id: "u-01", fullName: "Bruno Silva" } });
    assert.equal(appState.authToken, "token-01");
    assert.equal(isAuthenticated(appState), true);

    localStorage.setItem("ecommerce-shell:auth-token", "token-01");
    localStorage.setItem("ecommerce-shell:auth-user", JSON.stringify({ id: "u-01", fullName: "Stored Ada" }));
    const restored = { authToken: null, currentUser: null };
    readStoredAuth(restored);
    assert.equal(restored.authToken, "token-01");
    assert.equal(restored.currentUser.fullName, "Stored Ada");

    rememberPostLoginRedirect("/checkout");
    assert.equal(consumePostLoginRedirect(), "/checkout");
    rememberPostLoginRedirect("");
    assert.equal(consumePostLoginRedirect(), null);
  } finally {
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
  }
});
