/**
 * Publishes and subscribes to account contracts.
 * Role: Exposes profile-save-requested over an injected transport.
 * Not in this file: Profile forms or auth token storage.
 * Key dependencies: src/accountEventsContracts.js.
 * See also: src/index.js.
 */

import { ACCOUNT_TOPIC, ACCOUNT_PROFILE_SAVE_REQUESTED_EVENT } from "./accountEventsContracts.js";

/**
 * Creates account event operations bound to a transport.
 *
 * @param {{ publish: (message: { topic: string, event: string, payload?: object, scope: string }) => void, subscribe: (topic: string, event: string, callback: (message: { payload?: unknown }) => void) => () => void }} transport - Branch transport.
 * @returns {{ publishProfileUpdated: (payload?: object) => void, subscribeToProfileUpdates: (listener: (payload: unknown) => void) => () => void }} Account event operations.
 */
function createAccountEvents({ publish, subscribe }) {
  function publishProfileUpdated(payload) {
    publish({
      topic: ACCOUNT_TOPIC,
      event: ACCOUNT_PROFILE_SAVE_REQUESTED_EVENT,
      payload,
      scope: "local",
    });
  }

  function subscribeToProfileUpdates(listener) {
    return subscribe(ACCOUNT_TOPIC, ACCOUNT_PROFILE_SAVE_REQUESTED_EVENT, (message) => {
      listener(message.payload);
    });
  }

  return { publishProfileUpdated, subscribeToProfileUpdates };
}

export { createAccountEvents };
