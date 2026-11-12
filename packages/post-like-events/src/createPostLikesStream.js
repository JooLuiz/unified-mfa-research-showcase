/**
 * One mesh subscription per tab for post-like changes and new-post pushes, with a session-wide
 *   watching announce.
 * Role: Opens the community-likes/changed and community-posts/created subscriptions (and a
 *   recurring community-posts/watching announce) once the mesh client is connected, and fans
 *   events out to listeners that may have registered before the socket opened.
 * Not in this file: The module-level singleton that lets many callers share one connection
 *   (src/postLikeEventsClient.js) or the toggle write (src/togglePostLike.js).
 * Key dependencies: event-mesh/mesh; src/createPostLikeEvents.js; src/postLikeEventsContracts.js.
 * See also: apps/mock-data-service/src/event-mesh/postLikeHandler.js;
 *   apps/mock-data-service/src/infrastructure/postLikeEventStream.js.
 *   On main this module opens a Server-Sent Events stream; this branch subscribes through the
 *   gateway. Per-post community-likes/watching is published by each mounted post card via
 *   @shared/community-events, not here.
 */

import mesh from "event-mesh/mesh";
import { createPostLikeEvents } from "./createPostLikeEvents.js";
import {
  COMMUNITY_LIKES_CHANGED_EVENT,
  COMMUNITY_LIKES_TOPIC,
  COMMUNITY_POSTS_CREATED_EVENT,
  COMMUNITY_POSTS_TOPIC,
  COMMUNITY_POSTS_WATCHING_EVENT,
} from "./postLikeEventsContracts.js";

const WATCHING_ANNOUNCE_INTERVAL_MS = 10_000;
const MESH_CONNECT_TIMEOUT_MS = 5000;

/**
 * Creates a tab-scoped post-likes stream backed by the local mesh client. Call start once per
 *   signed-in or guest session; the stream stays open until stop.
 *
 * @returns {{ start: () => Promise<void>, stop: () => void, subscribe: (listener: (event: { postId: string, likes: number, ownerId: string, likerId: string, likerName: string, liked: boolean }) => void) => () => void, subscribeToPostCreated: (listener: (post: object) => void) => () => void }} Stream controls.
 */
function createPostLikesStream() {
  /** @type {Set<(message: { payload?: { postId: string, likes: number, ownerId: string, likerId: string, likerName: string, liked: boolean } }) => void>} */
  const likesChangedCallbacks = new Set();
  /** @type {Set<(message: { payload?: object }) => void>} */
  const postCreatedCallbacks = new Set();
  const postLikeEvents = createPostLikeEvents({
    subscribe(topic, event, callback) {
      if (event === COMMUNITY_LIKES_CHANGED_EVENT) {
        likesChangedCallbacks.add(callback);
        return function unsubscribeFromLikeChanges() {
          likesChangedCallbacks.delete(callback);
        };
      }
      postCreatedCallbacks.add(callback);
      return function unsubscribeFromPostCreated() {
        postCreatedCallbacks.delete(callback);
      };
    },
  });

  let streamGeneration = 0;
  let unsubscribeFromMeshLikesChanged = null;
  let unsubscribeFromMeshPostCreated = null;
  let watchingIntervalId = null;
  let isStartInFlight = false;

  /**
   * Calls every registered likes-changed listener with one pushed like change.
   *
   * @param {{ postId: string, likes: number, ownerId: string, likerId: string, likerName: string, liked: boolean }} payload - community-likes/changed payload.
   * @returns {void}
   */
  function notifyLikesChangedListeners(payload) {
    likesChangedCallbacks.forEach((callback) => {
      callback({ payload });
    });
  }

  /**
   * Calls every registered post-created listener with one pushed post.
   *
   * @param {object} post - community-posts/created payload.
   * @returns {void}
   */
  function notifyPostCreatedListeners(post) {
    postCreatedCallbacks.forEach((callback) => {
      callback({ payload: post });
    });
  }

  /**
   * Tells the gateway this WebSocket should receive every newly created post. Safe for guests
   * too: new posts are public, the same way post likes are.
   *
   * @returns {void}
   * @sideEffects Publishes community-posts/watching with distributed scope.
   */
  function publishWatchingAnnounce() {
    mesh.publish({
      topic: COMMUNITY_POSTS_TOPIC,
      event: COMMUNITY_POSTS_WATCHING_EVENT,
      payload: {},
      scope: "distributed",
    });
  }

  /**
   * Starts the community-likes/changed and community-posts/created mesh subscriptions, plus the
   *   recurring community-posts/watching announce. Safe to call for guests too: like counts and
   *   new posts are public, so a guest viewing the feed still receives live updates even though
   *   liking itself requires signing in.
   *
   * @returns {Promise<void>}
   * @sideEffects Subscribes to community-likes/changed and community-posts/created and publishes
   *   community-posts/watching immediately and on an interval.
   */
  async function start() {
    if ((unsubscribeFromMeshLikesChanged && unsubscribeFromMeshPostCreated) || isStartInFlight) {
      return;
    }

    const generation = ++streamGeneration;
    isStartInFlight = true;
    try {
      await mesh.whenConnected({ timeoutMs: MESH_CONNECT_TIMEOUT_MS });
      if (generation !== streamGeneration) {
        return;
      }

      publishWatchingAnnounce();
      unsubscribeFromMeshLikesChanged = mesh.subscribe(
        COMMUNITY_LIKES_TOPIC,
        COMMUNITY_LIKES_CHANGED_EVENT,
        (message) => {
          notifyLikesChangedListeners(message.payload);
        },
      );
      unsubscribeFromMeshPostCreated = mesh.subscribe(
        COMMUNITY_POSTS_TOPIC,
        COMMUNITY_POSTS_CREATED_EVENT,
        (message) => {
          notifyPostCreatedListeners(message.payload);
        },
      );
      watchingIntervalId = window.setInterval(
        publishWatchingAnnounce,
        WATCHING_ANNOUNCE_INTERVAL_MS,
      );
    } catch (error) {
      console.warn("createPostLikesStream - start error");
      console.warn(error);
    } finally {
      if (generation === streamGeneration) {
        isStartInFlight = false;
      }
    }
  }

  /**
   * Stops the mesh subscriptions and the watching announce without closing the mesh client.
   *
   * @returns {void}
   * @sideEffects Clears the watching interval and removes both mesh subscriptions.
   */
  function stop() {
    streamGeneration += 1;
    isStartInFlight = false;

    if (watchingIntervalId) {
      window.clearInterval(watchingIntervalId);
      watchingIntervalId = null;
    }

    if (unsubscribeFromMeshLikesChanged) {
      unsubscribeFromMeshLikesChanged();
      unsubscribeFromMeshLikesChanged = null;
    }

    if (unsubscribeFromMeshPostCreated) {
      unsubscribeFromMeshPostCreated();
      unsubscribeFromMeshPostCreated = null;
    }
  }

  /**
   * Subscribes to every community-likes/changed push, regardless of which post it names.
   *
   * @param {(event: { postId: string, likes: number, ownerId: string, likerId: string, likerName: string, liked: boolean }) => void} listener - Called for every push.
   * @returns {() => void} Unsubscribe function.
   * @sideEffects Registers the listener on the shared like module. Mesh subscribe stays in start.
   */
  function subscribe(listener) {
    return postLikeEvents.subscribeToLikeChanges(listener);
  }

  /**
   * Subscribes to every community-posts/created push on this same connection.
   *
   * @param {(post: object) => void} listener - Called with the newly created post.
   * @returns {() => void} Unsubscribe function.
   * @sideEffects Registers the listener on the shared like module. Mesh subscribe stays in start.
   */
  function subscribeToPostCreated(listener) {
    return postLikeEvents.subscribeToPostCreated(listener);
  }

  return { start, stop, subscribe, subscribeToPostCreated };
}

export { createPostLikesStream };
