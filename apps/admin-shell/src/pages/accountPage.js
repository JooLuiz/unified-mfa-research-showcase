/**
 * Renders the personal account route for the admin shell.
 * Role: Composes editable profile and address remotes without exposing personal order or post history.
 * Not in this file: Account HTTP updates or admin dashboard data.
 * Key dependencies: account/AccountProfile and account/AccountAddress remotes.
 * See also: src/commands/accountCommands.js.
 */

import { persistAccountUpdate } from "../commands/accountCommands";
import { requestSignOutEverywhere } from "@shared/session-events";
import { publishLogoutRequested } from "../events/eventBus";
import { MOCK_API_BASE_URL } from "../utils/constants";
import { navigate } from "../utils/navigate";

/**
 * Renders the authenticated admin's editable profile and address sections.
 *
 * @param {object} appState - Shell state holding the authenticated admin session.
 * @param {HTMLElement} pageMount - Route container element.
 * @param {Array<() => void>} activeCleanupFunctions - Cleanup registry for the current route.
 * @returns {Promise<void>}
 * @sideEffects Dynamically mounts account remotes and registers their cleanup functions.
 */
async function renderAccountPage(appState, pageMount, activeCleanupFunctions) {
  pageMount.innerHTML = `
    <section class="account-page">
      <div class="account-page-header">
        <h2>My Account</h2>
        <div class="account-page-actions">
          <button id="backToDashboardButton" class="account-action-button" type="button">
            Back to dashboard
          </button>
          <button id="signOutEverywhereButton" class="account-action-button account-action-button-danger" type="button">
            Sign out everywhere
          </button>
        </div>
      </div>
      <div id="accountProfileMount"></div>
      <div id="accountAddressMount"></div>
    </section>
  `;

  const backToDashboardButton = pageMount.querySelector("#backToDashboardButton");
  backToDashboardButton.addEventListener("click", () => navigate("/"));

  const signOutEverywhereButton = pageMount.querySelector("#signOutEverywhereButton");
  if (signOutEverywhereButton) {
    signOutEverywhereButton.addEventListener("click", async () => {
      signOutEverywhereButton.disabled = true;
      try {
        await requestSignOutEverywhere({
          apiBaseUrl: MOCK_API_BASE_URL,
          authToken: appState.authToken,
        });
      } catch (error) {
        console.warn("signOutEverywhereButton - error");
        console.warn(error);
      }
      publishLogoutRequested();
    });
  }

  const accountProfileMount = pageMount.querySelector("#accountProfileMount");
  const accountAddressMount = pageMount.querySelector("#accountAddressMount");
  const [accountProfileModule, accountAddressModule] = await Promise.all([
    import("account/AccountProfile"),
    import("account/AccountAddress"),
  ]);

  activeCleanupFunctions.push(
    accountProfileModule.mountAccountProfile(accountProfileMount, {
      user: appState.currentUser,
      onSaveProfile: (profilePayload) =>
        persistAccountUpdate(appState, profilePayload),
    }),
  );
  activeCleanupFunctions.push(
    accountAddressModule.mountAccountAddress(accountAddressMount, {
      address: appState.currentUser?.address,
      onSaveAddress: (addressPayload) =>
        persistAccountUpdate(appState, { address: addressPayload }),
    }),
  );
}

export { renderAccountPage };
