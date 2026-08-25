/**
 * Renders the login route for the admin shell.
 * Role: Mounts the login MFE and owns the post-login admin check, session, toast, and redirect outcome.
 * Not in this file: Login form or credential validation (login MFE); login failure stays in the MFE.
 * Key dependencies: src/utils/authActions.js; src/notifications/notificationBus.js.
 * See also: src/utils/renderActions.js (public barrel).
 */

import { navigate } from "../utils/navigate";
import {
  isAdminAuthenticated,
  setAuthSession,
  clearAuthSession,
  consumePostLoginRedirect,
} from "../utils/authActions";
import { MOCK_API_BASE_URL } from "../utils/constants";
import { notify } from "../notifications/notificationBus";

/**
 * Renders the login page, redirecting away when already authenticated as admin.
 *
 * @param {object} appState - Shell state holding the auth session.
 * @param {HTMLElement} pageMount - Route container element.
 * @param {object} modules - Loaded remote module mount functions.
 * @param {Array<() => void>} activeCleanupFunctions - Cleanup registry for the current route.
 * @returns {Promise<void>}
 * @sideEffects On admin login success stores the session, notifies, and navigates; on non-admin login rejects with a toast.
 */
async function renderLoginPage(appState, pageMount, modules, activeCleanupFunctions) {
  if (isAdminAuthenticated(appState)) {
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
        if (user?.role !== "admin") {
          clearAuthSession(appState);
          notify({
            type: "error",
            title: "Access denied",
            message: "This account does not have admin access.",
          });
          return;
        }
        setAuthSession(appState, { token, user });
        notify({
          type: "success",
          title: "Signed in",
          message: `Welcome back, ${user.fullName || user.username}.`,
        });
        const targetPath = redirectAfterLogin || "/";
        navigate(targetPath);
      },
      onCancel: () => navigate("/"),
    }),
  );
}

export { renderLoginPage };
