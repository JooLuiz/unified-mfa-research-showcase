/**
 * HTTP command for revoking all sessions of the current user.
 * Role: Dispatches POST /auth/sign-out-everywhere with the current bearer token.
 * Not in this file: Toast UI or shell logout. Those stay in each shell.
 * Key dependencies: src/sessionEventsContracts.js; src/sessionLiveEventsClient.js.
 * See also: src/sessionLiveEventsClient.js.
 */

import { SIGN_OUT_EVERYWHERE_PATH } from "./sessionEventsContracts.js";
import { stopSessionLiveEvents } from "./sessionLiveEventsClient.js";

/**
 * Sends a request to sign out from all sessions everywhere.
 * Stops this tab's own session/revoked subscription first, so the server's broadcast to every
 * open socket arrives here with nothing registered to receive it.
 *
 * @param {{ apiBaseUrl: string, authToken: string }} input - Base URL and current bearer token.
 * @returns {Promise<{ ok: boolean, status: number }>} Outcome of the request.
 * @sideEffects Unsubscribes this tab's session/revoked handler, then POSTs the revoke.
 */
async function requestSignOutEverywhere({ apiBaseUrl, authToken }) {
  if (!authToken) {
    return { ok: false, status: 401 };
  }
  stopSessionLiveEvents();
  const response = await fetch(`${apiBaseUrl}${SIGN_OUT_EVERYWHERE_PATH}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });
  return { ok: response.ok, status: response.status };
}

export { requestSignOutEverywhere };
