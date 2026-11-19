/**
 * Verifies the social login page redirects a signed-in member and mounts the form otherwise.
 * Role: Locks the login redirect and the login section a visitor sees.
 * Not in this file: Credential checks inside the login remote.
 * Key dependencies: node:test; src/pages/authenticationPages.js; test/support/createPageDocument.js.
 * See also: src/pages/authenticationPages.js.
 */

import assert from "node:assert/strict";
import "../../../../test/support/installBrowserGlobals.js";
import {
  createRemoteRecorder,
  installPageDocument,
  invokeHandler,
  latestRemoteCall,
  queueTest,
  resetLocation,
} from "../../../../test/support/createPageDocument.js";
import { loadAppModule } from "../../../../test/support/loadAppModule.js";
import { POST_LOGIN_REDIRECT_STORAGE_KEY } from "../utils/constants.js";

const { createPageRoot } = await installPageDocument();
const { renderLoginPage } = await loadAppModule(
  new URL("./authenticationPages.js", import.meta.url).href,
);

queueTest("sends a signed-in member to the remembered path", async () => {
  sessionStorage.setItem(POST_LOGIN_REDIRECT_STORAGE_KEY, "/posts");
  resetLocation("/login");
  await renderLoginPage(
    { authToken: "token-01", currentUser: { id: "user-01", username: "ada" } },
    createPageRoot(),
    createRemoteRecorder(),
    [],
  );
  assert.equal(window.location.pathname, "/posts");

  resetLocation("/login");
  await renderLoginPage(
    { authToken: "token-01", currentUser: { id: "user-01", username: "ada" } },
    createPageRoot(),
    createRemoteRecorder(),
    [],
  );
  assert.equal(window.location.pathname, "/");
});

queueTest("mounts the login form for a guest", async () => {
  resetLocation("/login");
  const pageRoot = createPageRoot();
  const remotes = createRemoteRecorder();
  const appState = { authToken: null, currentUser: null };
  await renderLoginPage(appState, pageRoot, remotes, []);
  assert.equal(pageRoot.querySelector("#loginMount").className, "page-content");

  const loginProps = latestRemoteCall(remotes, "login").props;
  assert.equal(loginProps !== undefined, true);
});
