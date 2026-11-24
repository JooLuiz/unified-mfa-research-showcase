/**
 * Persists account profile and address updates for the ecommerce shell.
 * Role: Owns the account update command and reports its outcome through the shell notifier.
 * Not in this file: Account page layout or order history (src/pages/accountPage.js).
 * Key dependencies: An injected shell transport (account:update); src/notifications/notificationAdapter.js.
 * See also: src/pages/accountPage.js.
 */

import { setAuthSession } from "../utils/authActions";
import { publishNotification } from "../notifications/notificationAdapter";

const ACCOUNT_TOPIC = "account";
const ACCOUNT_UPDATE_EVENT = "update";

/**
 * Persists an account update and reports its outcome to the shell notifier.
 *
 * @param {{ request: (message: { topic: string, event: string, payload?: object }) => Promise<{ ok: boolean, user?: object, code?: string }> }} transport - Shell transport that runs the account update request.
 * @param {object} appState - Shell state containing the authenticated session.
 * @param {object} updatePayload - Profile or address fields accepted by the account update.
 * @returns {Promise<{ ok: boolean }>} Whether the server accepted the update.
 * @sideEffects Requests account:update, updates the persisted session, and emits a local notification.
 */
async function persistAccountUpdate(transport, appState, updatePayload) {
  if (!appState.authToken) {
    return { ok: false };
  }

  const outcome = await transport.request({
    topic: ACCOUNT_TOPIC,
    event: ACCOUNT_UPDATE_EVENT,
    payload: { authToken: appState.authToken, update: updatePayload },
  });
  if (!outcome.ok) {
    publishNotification({
      type: "error",
      title: "Account update failed",
      message: "Your changes were not saved. Please try again.",
    });
    return { ok: false };
  }

  setAuthSession(appState, {
    token: appState.authToken,
    user: outcome.user,
  });
  const isAddressUpdate = Object.hasOwn(updatePayload, "address");
  publishNotification({
    type: "success",
    title: isAddressUpdate ? "Address updated" : "Profile updated",
    message: "Your account changes have been saved.",
  });
  return { ok: true };
}

export { persistAccountUpdate };
