/**
 * HTTP command for revoking all sessions of the current user.
 * Role: Dispatches POST /auth/sign-out-everywhere with the current bearer token.
 * Not in this file: Stream handling or UI state.
 * Key dependencies: src/sessionEventsContracts.js.
 * See also: src/sessionEventsClient.js.
 */

import { SIGN_OUT_EVERYWHERE_PATH } from "./sessionEventsContracts.js";

/**
 * Sends a request to sign out from all sessions everywhere.
 *
 * @param {{ apiBaseUrl: string, authToken: string }} input - Base URL and current bearer token.
 * @returns {Promise<{ ok: boolean, status: number }>} Outcome of the request.
 */
async function requestSignOutEverywhere({ apiBaseUrl, authToken }) {
  if (!authToken) {
    return { ok: false, status: 401 };
  }
  const response = await fetch(`${apiBaseUrl}${SIGN_OUT_EVERYWHERE_PATH}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
  });
  return { ok: response.ok, status: response.status };
}

export { requestSignOutEverywhere };
