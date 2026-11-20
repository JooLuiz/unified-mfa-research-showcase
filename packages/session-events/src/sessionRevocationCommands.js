/**
 * Sign-out command for every session of the current user.
 * Role: Suppresses this tab's own revocation toast, closes the local subscription, then asks the server to revoke every session.
 * Not in this file: Toast UI or shell logout.
 * Key dependencies: src/sessionEventsClient.js. The caller supplies the transport.
 * See also: src/sessionEventsClient.js.
 */

import { markLocalSignOut, stopSessionStream } from "./sessionEventsClient.js";

/**
 * Signs the current user out of every session.
 * Marks this tab first so its own session.revoked broadcast does not notify listeners, then closes the local subscription before the server writes that event.
 *
 * @param {{ request: Function }} transport - Event interface. A missing bearer token returns status 401.
 * @returns {Promise<{ ok: boolean, status?: number }>} Outcome of the request.
 * @sideEffects Suppresses this tab's revoke listeners and closes its session subscription, then sends session/sign-out-everywhere.
 */
async function requestSignOutEverywhere(transport) {
  markLocalSignOut();
  stopSessionStream();
  return transport.request({
    topic: "session",
    event: "sign-out-everywhere",
    payload: {},
  });
}

export { requestSignOutEverywhere };
