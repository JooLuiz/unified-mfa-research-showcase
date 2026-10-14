/**
 * Authenticated JSON fetch helper for ecommerce-shell API calls.
 * Role: Wraps fetch with JSON parsing and a shared 401 fallback for when a session revoke
 *   broadcast was missed (socket was down, tab was backgrounded, etc).
 * Not in this file: Credential storage or the live revoke push (events/sessionRevoked handling
 *   in src/main.js; @shared/session-events).
 * Key dependencies: src/events/eventBus.js.
 * See also: apps/mock-data-service/src/event-mesh/sessionEventStream.js.
 */

import { publishLogoutRequested } from "../events/eventBus";

/**
 * Fetches a URL and parses the JSON body, throwing on a non-OK response.
 *
 * @param {string} url - Request URL.
 * @param {RequestInit} [options] - Standard fetch options.
 * @returns {Promise<unknown>} Parsed JSON body.
 * @throws {Error} When the response status is not OK.
 * @sideEffects When the request carried an Authorization header and the response is 401,
 *   publishes a local logout request before throwing. This is a backstop: the live
 *   session/revoked mesh push already clears the session on the tabs it reaches; this covers
 *   the tab whose socket was down when the server broadcast it.
 */
async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    if (response.status === 401 && options.headers?.Authorization) {
      publishLogoutRequested();
    }
    throw new Error(
      `Request failed: ${response.status} ${response.statusText}`,
    );
  }
  return response.json();
}

export default fetchJson;
