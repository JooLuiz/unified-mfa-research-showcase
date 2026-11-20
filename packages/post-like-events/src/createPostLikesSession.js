/**
 * Post-like and new-post subscriptions over an injected transport.
 * Role: Exposes the two listeners that share the posts stream.
 * Not in this file: The module-level singleton (src/postLikeEventsClient.js) or the toggle write.
 * Key dependencies: src/createPostLikeEvents.js.
 * See also: src/postLikeEventsClient.js.
 */

import { createPostLikeEvents } from "./createPostLikeEvents.js";

/**
 * Binds like and new-post listeners to one transport.
 *
 * @param {{ subscribe: Function }} transport - Event interface.
 * @returns {{ subscribe: (listener: (event: object) => void) => () => void, subscribeToPostCreated: (listener: (post: object) => void) => () => void }} Stream controls.
 * @sideEffects Subscribes when the returned functions are called.
 */
function createPostLikesStream(transport) {
  const postLikeEvents = createPostLikeEvents(transport);

  /**
   * Subscribes to every community.post-likes-changed push.
   *
   * @param {(event: object) => void} listener - Called for every push.
   * @returns {() => void} Unsubscribe function.
   * @sideEffects Registers the listener.
   */
  function subscribe(listener) {
    return postLikeEvents.subscribeToLikeChanges(listener);
  }

  /**
   * Subscribes to every community.post-created push.
   *
   * @param {(post: object) => void} listener - Called with each newly created post.
   * @returns {() => void} Unsubscribe function.
   * @sideEffects Registers the listener.
   */
  function subscribeToPostCreated(listener) {
    return postLikeEvents.subscribeToPostCreated(listener);
  }

  return { subscribe, subscribeToPostCreated };
}

export { createPostLikesStream };
