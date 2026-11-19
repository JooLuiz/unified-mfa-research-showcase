/**
 * Verifies a rejected account refresh signs the admin out.
 * Role: Locks the session outcomes of the admin auth helpers.
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
  isAdminAuthenticated,
  isAdminRoute,
  readStoredAuth,
  refreshCurrentUserFromApi,
  rememberPostLoginRedirect,
  setAuthSession,
} = await loadAppModule(new URL("./authActions.js", import.meta.url).href);

test("a rejected account refresh signs the admin out, and a failed refresh keeps the previous user", async () => {
  const originalFetch = globalThis.fetch;
  const originalWarn = console.warn;
  console.warn = () => {};
  const appState = {
    authToken: "token-01",
    currentUser: { id: "admin-01", role: "admin", fullName: "Alice" },
  };
  setAuthSession(appState, { token: "", user: null });
  assert.equal(appState.authToken, null);
  assert.equal(isAdminAuthenticated(appState), false);
  assert.equal(isAdminRoute("/orders"), true);
  assert.equal(isAdminRoute("/login"), false);

  appState.authToken = "";
  await refreshCurrentUserFromApi(appState);
  assert.equal(appState.currentUser, null);

  appState.authToken = "token-01";
  appState.currentUser = { id: "admin-01", role: "admin", fullName: "Alice" };
  globalThis.fetch = async () => ({ ok: false, status: 401, json: async () => ({}) });
  try {
    await refreshCurrentUserFromApi(appState);
    assert.equal(isAdminAuthenticated(appState), false);

    appState.authToken = "token-01";
    appState.currentUser = { id: "admin-01", role: "customer", fullName: "Alice" };
    globalThis.fetch = async () => {
      throw new Error("offline");
    };
    await refreshCurrentUserFromApi(appState);
    assert.equal(appState.currentUser.role, "customer");
    assert.equal(isAdminAuthenticated(appState), false);

    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ id: "admin-01", role: "admin", fullName: "Ada Byron" }),
    });
    await refreshCurrentUserFromApi(appState);
    assert.equal(appState.currentUser.fullName, "Ada Byron");
    assert.equal(isAdminAuthenticated(appState), true);

    setAuthSession(appState, {
      token: "token-01",
      user: { id: "admin-01", role: "admin", fullName: "Ada Byron" },
    });
    assert.equal(isAdminAuthenticated(appState), true);

    localStorage.setItem("admin-shell:auth-token", "token-01");
    localStorage.setItem(
      "admin-shell:auth-user",
      JSON.stringify({ id: "admin-01", role: "admin", fullName: "Stored Ada" }),
    );
    const restored = { authToken: null, currentUser: null };
    readStoredAuth(restored);
    assert.equal(restored.currentUser.fullName, "Stored Ada");

    rememberPostLoginRedirect("/orders");
    assert.equal(consumePostLoginRedirect(), "/orders");
    rememberPostLoginRedirect("");
    assert.equal(consumePostLoginRedirect(), null);
  } finally {
    globalThis.fetch = originalFetch;
    console.warn = originalWarn;
  }
});
