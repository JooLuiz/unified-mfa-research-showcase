/**
 * HTTP command for revoking all sessions of the current user.
 * Role: Dispatches POST /auth/sign-out-everywhere with the current bearer token.
 * Not in this file: Toast UI or shell logout. Those stay in each shell.
 * Key dependencies: src/sessionEventsContracts.js; src/sessionEventsClient.js.
 * See also: src/sessionEventsClient.js.
 */

import { SIGN_OUT_EVERYWHERE_PATH } from "./sessionEventsContracts.js";
import { markLocalSignOut, stopSessionStream } from "./sessionEventsClient.js";

/**
 * Sends a request to sign out from all sessions everywhere.
 * Marks this tab first so its own session.revoked broadcast does not notify listeners, then closes the local stream before the server writes that event.
 *
 * @param {{ apiBaseUrl: string, authToken: string }} input - Base URL and current bearer token.
 * @returns {Promise<{ ok: boolean, status: number }>} Outcome of the request.
 * @sideEffects Suppresses this tab's revoke listeners and closes its session stream, then POSTs the revoke.
 */
async function requestSignOutEverywhere({ apiBaseUrl, authToken }) {
  if (!authToken) {
    return { ok: false, status: 401 };
  }
  markLocalSignOut();
  stopSessionStream();
  const response = await fetch(`${apiBaseUrl}${SIGN_OUT_EVERYWHERE_PATH}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });
  return { ok: response.ok, status: response.status };
}

export { requestSignOutEverywhere };
