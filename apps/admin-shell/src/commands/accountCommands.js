/**
 * Persists personal account changes for the admin shell.
 * Role: Owns the account HTTP command and reports its outcome through the shell notifier.
 * Not in this file: Account page layout or form rendering.
 * Key dependencies: Mock data service PUT /api/users/me; src/notifications/notificationBus.js.
 * See also: src/pages/accountPage.js.
 */

import { setAuthSession } from "../utils/authActions";
import { MOCK_API_BASE_URL } from "../utils/constants";
import fetchJson from "../utils/fetchJson";
import { notify } from "../notifications/notificationBus";

/**
 * Persists profile or address data and refreshes the stored admin session.
 *
 * @param {object} appState - Shell state containing the authenticated admin session.
 * @param {object} updatePayload - Profile or address fields accepted by the account endpoint.
 * @returns {Promise<{ ok: boolean }>} Whether the server accepted the update.
 * @sideEffects Updates persisted auth state and emits a page-local notification.
 */
async function persistAccountUpdate(appState, updatePayload) {
  if (!appState.authToken) {
    return { ok: false };
  }

  try {
    const updatedUser = await fetchJson(`${MOCK_API_BASE_URL}/users/me`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${appState.authToken}`,
      },
      body: JSON.stringify(updatePayload),
    });
    setAuthSession(appState, {
      token: appState.authToken,
      user: updatedUser,
    });

    const isAddressUpdate = Object.hasOwn(updatePayload, "address");
    notify({
      type: "success",
      title: isAddressUpdate ? "Address updated" : "Profile updated",
      message: "Your account changes have been saved.",
    });
    return { ok: true };
  } catch {
    notify({
      type: "error",
      title: "Account update failed",
      message: "Your changes were not saved. Please try again.",
    });
    return { ok: false };
  }
}

export { persistAccountUpdate };
