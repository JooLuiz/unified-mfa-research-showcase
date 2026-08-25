/**
 * Renders the login route for the social media shell.
 * Role: Mounts the login MFE and owns the post-login session, toast, and redirect outcome.
 * Not in this file: Login form or credential validation (login MFE); login failure stays in the MFE.
 * Key dependencies: src/utils/authActions.js; src/notifications/notificationBus.js.
 * See also: src/utils/renderActions.js (public barrel).
 */

import { navigate } from "../utils/navigate";
import {
  isAuthenticated,
  setAuthSession,
  consumePostLoginRedirect,
} from "../utils/authActions";
import { MOCK_API_BASE_URL } from "../utils/constants";
import { notify } from "../notifications/notificationBus";

/**
 * Renders the login page, redirecting away when already authenticated.
 *
 * @param {object} appState - Shell state holding the auth session.
 * @param {HTMLElement} pageMount - Route container element.
 * @param {object} modules - Loaded remote module mount functions.
 * @param {Array<() => void>} activeCleanupFunctions - Cleanup registry for the current route.
 * @returns {Promise<void>}
 * @sideEffects On login success stores the session, notifies, and navigates.
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
      onLoginSuccess: ({ token, user, redirectAfterLogin }) => {
        setAuthSession(appState, { token, user });
        notify({
          type: "success",
          title: "Signed in",
          message: `Welcome back, ${user.fullName || user.username}.`,
        });
        const targetPath = redirectAfterLogin || "/account";
        navigate(targetPath);
      },
      onCancel: () => navigate("/"),
    }),
  );
}

export { renderLoginPage };
