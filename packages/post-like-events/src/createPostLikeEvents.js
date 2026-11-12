/**
 * Subscribes to live like counts and new posts over an injected transport.
 * Role: Delivers one like payload and one created-post payload on separate subscribers.
 * Not in this file: The EventSource stream (src/createPostLikesSession.js) or the like toggle HTTP command.
 * Key dependencies: src/postLikeEventsContracts.js. The caller supplies publish and subscribe.
 * See also: src/createPostLikesSession.js; src/createPostLikesSession.test.js.
 */

import {
  COMMUNITY_LIKES_CHANGED_EVENT,
  COMMUNITY_LIKES_TOPIC,
  COMMUNITY_POSTS_CREATED_EVENT,
  COMMUNITY_POSTS_TOPIC,
} from "./postLikeEventsContracts.js";

/**
 * Creates like and new-post subscriptions bound to a transport.
 *
 * @param {{ publish: (message: { topic: string, event: string, payload?: object, scope?: string }) => void, subscribe: (topic: string, event: string, callback: (message: { payload?: unknown }) => void) => () => void }} transport - Branch transport.
 * @returns {{ subscribeToLikeChanges: (listener: (likeEvent: object) => void) => () => void, subscribeToPostCreated: (listener: (post: object) => void) => () => void }} Like and new-post operations.
 * @sideEffects Subscribes to community-likes/changed and community-posts/created.
 */
function createPostLikeEvents({ subscribe }) {
  /**
   * Subscribes to live like-count updates.
   *
   * @param {(likeEvent: object) => void} listener - Called with each like payload.
   * @returns {() => void} Function that removes the subscription.
   * @sideEffects Registers a transport subscription.
   */
  function subscribeToLikeChanges(listener) {
    return subscribe(COMMUNITY_LIKES_TOPIC, COMMUNITY_LIKES_CHANGED_EVENT, (message) => {
      listener(message.payload);
    });
  }

  /**
   * Subscribes to newly created posts.
   *
   * @param {(post: object) => void} listener - Called with each created post.
   * @returns {() => void} Function that removes the subscription.
   * @sideEffects Registers a transport subscription.
   */
  function subscribeToPostCreated(listener) {
    return subscribe(COMMUNITY_POSTS_TOPIC, COMMUNITY_POSTS_CREATED_EVENT, (message) => {
      listener(message.payload);
    });
  }

  return { subscribeToLikeChanges, subscribeToPostCreated };
}

export {
  COMMUNITY_LIKES_CHANGED_EVENT,
  COMMUNITY_LIKES_TOPIC,
  COMMUNITY_POSTS_CREATED_EVENT,
  COMMUNITY_POSTS_TOPIC,
  createPostLikeEvents,
};
