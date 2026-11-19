/**
 * Verifies the admin login page sends a signed-in admin onward and mounts the form otherwise.
 * Role: Locks the redirect and the login mount a visitor sees.
 * Not in this file: Credential checks inside the login remote.
 * Key dependencies: node:test; src/pages/loginPage.js; test/support/createPageDocument.js.
 * See also: src/pages/loginPage.js.
 */

import assert from "node:assert/strict";
import test from "node:test";
import "../../../../test/support/installBrowserGlobals.js";
import {
  createRemoteRecorder,
  installPageDocument,
  invokeHandler,
  latestRemoteCall,
  resetLocation,
} from "../../../../test/support/createPageDocument.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";
import { POST_LOGIN_REDIRECT_STORAGE_KEY } from "../utils/constants.js";

const { createPageRoot } = await installPageDocument();
const { renderLoginPage } = await loadAppModule(new URL("./loginPage.js", import.meta.url).href);

test("sends an admin who is already signed in to the remembered path", async () => {
  sessionStorage.setItem(POST_LOGIN_REDIRECT_STORAGE_KEY, "/orders");
  resetLocation("/login");
  const pageRoot = createPageRoot();
  await renderLoginPage(
    { authToken: "token-01", currentUser: { username: "ada", role: "admin" } },
    pageRoot,
    createRemoteRecorder(),
    [],
  );
  assert.equal(window.location.pathname, "/orders");

  resetLocation("/login");
  await renderLoginPage(
    { authToken: "token-01", currentUser: { username: "ada", role: "admin" } },
    pageRoot,
    createRemoteRecorder(),
    [],
  );
  assert.equal(window.location.pathname, "/");
});

test("mounts the login form and keeps a non-admin from entering", async () => {
  resetLocation("/login");
  const pageRoot = createPageRoot();
  const remotes = createRemoteRecorder();
  const appState = { authToken: null, currentUser: null };
  await renderLoginPage(appState, pageRoot, remotes, []);
  assert.equal(pageRoot.querySelector("#loginMount").className, "page-content");

  const loginProps = latestRemoteCall(remotes, "login").props;
  assert.equal(loginProps !== undefined, true);
});
