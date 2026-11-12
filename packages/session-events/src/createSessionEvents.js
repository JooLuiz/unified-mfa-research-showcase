/**
 * Subscribes to session revocation over an injected transport.
 * Role: Delivers one session/revoked notice until unsubscribe.
 * Not in this file: The EventSource session (src/createSessionSession.js) or the sign-out HTTP command.
 * Key dependencies: src/sessionEventsContracts.js. The caller supplies publish and subscribe.
 * See also: src/createSessionSession.js; src/createSessionSession.test.js.
 */

import { SESSION_REVOKED_EVENT, SESSION_TOPIC } from "./sessionEventsContracts.js";

/**
 * Creates session subscriptions bound to a transport.
 *
 * @param {{ publish: (message: { topic: string, event: string, payload?: object, scope?: string }) => void, subscribe: (topic: string, event: string, callback: (message: { payload?: unknown }) => void) => () => void }} transport - Branch transport.
 * @returns {{ subscribeToSessionRevoked: (listener: () => void) => () => void }} Session operations.
 * @sideEffects Subscribes to session/revoked.
 */
function createSessionEvents({ subscribe }) {
  /**
   * Subscribes to session revocation.
   *
   * @param {() => void} listener - Called once for each revocation delivered while subscribed.
   * @returns {() => void} Function that removes the subscription.
   * @sideEffects Registers a transport subscription.
   */
  function subscribeToSessionRevoked(listener) {
    return subscribe(SESSION_TOPIC, SESSION_REVOKED_EVENT, () => {
      listener();
    });
  }

  return { subscribeToSessionRevoked };
}

export { createSessionEvents, SESSION_REVOKED_EVENT, SESSION_TOPIC };
