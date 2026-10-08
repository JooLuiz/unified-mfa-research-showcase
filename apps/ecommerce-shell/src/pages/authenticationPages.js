/**
 * Renders the login route for the ecommerce shell.
 * Role: Mounts the login MFE with shell auth storage keys; session handoff is mesh-driven.
 * Not in this file: Credential validation (login MFE); welcome toast (main onAuthSessionChanged).
 * Key dependencies: src/utils/authActions.js; src/utils/constants.js.
 * See also: src/utils/renderActions.js (public barrel); MESH_IMPLEMENTATIONS/remote-intents.md.
 */

import { navigate } from "../utils/navigate";
import {
  isAuthenticated,
  consumePostLoginRedirect,
} from "../utils/authActions";
import {
  MOCK_API_BASE_URL,
  AUTH_TOKEN_STORAGE_KEY,
  AUTH_USER_STORAGE_KEY,
} from "../utils/constants";

/**
 * Renders the login page, redirecting away when already authenticated.
 *
 * @param {object} appState - Shell state holding the auth session.
 * @param {HTMLElement} pageMount - Route container element.
 * @param {object} modules - Loaded remote module mount functions.
 * @param {Array<() => void>} activeCleanupFunctions - Cleanup registry for the current route.
 * @returns {Promise<void>}
 * @sideEffects The login MFE writes storage and publishes auth.session-changed. Guest-cart merge runs in src/main.js.
 */
async function renderLoginPage(appState, pageMount, modules, activeCleanupFunctions) {
  if (isAuthenticated(appState)) {
    const redirectPath = consumePostLoginRedirect() || "/";
    navigate(redirectPath);
    return;
  }

  pageMount.innerHTML = `<section id="loginMount" class="page-content"></section>`;
  const loginMount = pageMount.querySelector("#loginMount");

  activeCleanupFunctions.push(
    modules.mountLoginForm(loginMount, {
      apiBaseUrl: MOCK_API_BASE_URL,
      redirectAfterLogin: consumePostLoginRedirect(),
      authTokenStorageKey: AUTH_TOKEN_STORAGE_KEY,
      authUserStorageKey: AUTH_USER_STORAGE_KEY,
      defaultRedirectPath: "/",
    }),
  );
}

export { renderLoginPage };
