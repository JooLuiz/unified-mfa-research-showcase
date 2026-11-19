/**
 * Verifies a rejected account refresh signs the viewer out.
 * Role: Locks the session outcomes of the social auth helpers.
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

test("a rejected account refresh signs the viewer out, and a failed refresh keeps the previous user", async () => {
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  console.warn = () => {};
  const appState = { authToken: "token-01", currentUser: { id: "u-01", fullName: "Bruno" } };
  setAuthSession(appState, { token: "", user: null });
  assert.equal(appState.authToken, null);
  assert.equal(isAuthenticated(appState), false);
  assert.equal(isProtectedRoute("/account"), true);
  assert.equal(isProtectedRoute("/posts"), false);

  appState.authToken = "";
  await refreshCurrentUserFromApi(appState);
  assert.equal(appState.currentUser, null);

  appState.authToken = "token-01";
  appState.currentUser = { id: "u-01", fullName: "Bruno" };
  globalThis.fetch = async () => ({ ok: false, status: 401, json: async () => ({}) });
  try {
    await refreshCurrentUserFromApi(appState);
    assert.equal(appState.authToken, null);

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

    setAuthSession(appState, { token: "token-01", user: { id: "u-01", fullName: "Bruno Silva" } });
    assert.equal(isAuthenticated(appState), true);

    localStorage.setItem("social-media-shell:auth-token", "token-01");
    localStorage.setItem(
      "social-media-shell:auth-user",
      JSON.stringify({ id: "u-01", fullName: "Stored Bruno" }),
    );
    const restored = { authToken: null, currentUser: null };
    readStoredAuth(restored);
    assert.equal(restored.currentUser.fullName, "Stored Bruno");

    rememberPostLoginRedirect("/account");
    assert.equal(consumePostLoginRedirect(), "/account");
    rememberPostLoginRedirect("");
    assert.equal(consumePostLoginRedirect(), null);
  } finally {
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
  }
});
