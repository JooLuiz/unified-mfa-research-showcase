/**
 * Publishes and subscribes to community contracts.
 * Role: Exposes post-submitted over an injected transport.
 * Not in this file: Post creation HTTP or iframe postMessage.
 * Key dependencies: src/communityEventsContracts.js.
 * See also: src/index.js.
 */

import { COMMUNITY_TOPIC, POST_SUBMITTED_EVENT } from "./communityEventsContracts.js";

/**
 * Creates community event operations bound to a transport.
 *
 * @param {{ publish: (message: { topic: string, event: string, payload?: object, scope: string }) => void, subscribe: (topic: string, event: string, callback: (message: { payload?: unknown }) => void) => () => void }} transport - Branch transport.
 * @returns {{ publishPostSubmitted: (payload?: object) => void, subscribeToPostSubmitted: (listener: (payload: unknown) => void) => () => void }} Community event operations.
 */
function createCommunityEvents({ publish, subscribe }) {
  function publishPostSubmitted(payload) {
    publish({
      topic: COMMUNITY_TOPIC,
      event: POST_SUBMITTED_EVENT,
      payload,
      scope: "local",
    });
  }

  function subscribeToPostSubmitted(listener) {
    return subscribe(COMMUNITY_TOPIC, POST_SUBMITTED_EVENT, (message) => {
      listener(message.payload);
    });
  }

  return { publishPostSubmitted, subscribeToPostSubmitted };
}

export { createCommunityEvents };
