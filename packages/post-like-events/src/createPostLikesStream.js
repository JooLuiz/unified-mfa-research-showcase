/**
 * One EventSource per tab for post-like changes and new-post pushes.
 * Role: Opens the public, guest-friendly social stream immediately and keeps it open with
 *   reconnect-with-backoff for the life of the tab, fanning out both
 *   community.post-likes-changed and community.post-created events to whichever listeners
 *   registered for each (even if they registered before the socket opened).
 * Not in this file: The module-level singleton that lets many callers share one connection
 *   (src/postLikeEventsClient.js) or the toggle write (src/togglePostLike.js).
 * Key dependencies: EventSource; src/postLikeEventsContracts.js.
 * See also: apps/mock-data-service/src/routes/postLikeRoutes.js (GET /posts/stream);
 *   apps/mock-data-service/src/routes/postRoutes.js (broadcasts post-created on the same stream).
 */

import {
  POST_LIKES_CHANGED_EVENT_NAME,
  POST_CREATED_EVENT_NAME,
  POST_LIKES_STREAM_PATH,
} from "./postLikeEventsContracts.js";

const INITIAL_RECONNECT_DELAY_MS = 2000;
const MAX_RECONNECT_DELAY_MS = 30_000;

/**
 * Creates and immediately opens a tab-scoped post-likes stream. Unlike the order-status
 * stream, this one needs no ticket and no auth token: the live like count is public
 * information, and guests must receive it the same way signed-in viewers do.
 *
 * @param {{ apiBaseUrl: string }} streamInput - Mock API base URL.
 * @returns {{ subscribe: (listener: (event: { postId: string, likes: number, ownerId: string, likerId: string, likerName: string, liked: boolean }) => void) => () => void, subscribeToPostCreated: (listener: (post: object) => void) => () => void }} Stream controls.
 */
function createPostLikesStream({ apiBaseUrl }) {
  /** @type {Set<(event: { postId: string, likes: number, ownerId: string, likerId: string, likerName: string, liked: boolean }) => void>} */
  const listeners = new Set();
  /** @type {Set<(post: object) => void>} */
  const postCreatedListeners = new Set();
  let activeEventSource = null;
  let reconnectTimeoutId = null;
  let reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;

  function clearReconnectTimer() {
    if (reconnectTimeoutId) {
      window.clearTimeout(reconnectTimeoutId);
      reconnectTimeoutId = null;
    }
  }

  function dispatchLikesChanged(messageEvent) {
    const likesChangedEvent = JSON.parse(messageEvent.data);
    listeners.forEach((listener) => listener(likesChangedEvent));
  }

  function dispatchPostCreated(messageEvent) {
    const createdPost = JSON.parse(messageEvent.data);
    postCreatedListeners.forEach((listener) => listener(createdPost));
  }

  function scheduleReconnect() {
    clearReconnectTimer();
    reconnectTimeoutId = window.setTimeout(() => {
      reconnectDelayMs = Math.min(reconnectDelayMs * 2, MAX_RECONNECT_DELAY_MS);
      openStream();
    }, reconnectDelayMs);
  }

  function openStream() {
    clearReconnectTimer();
    if (activeEventSource) {
      activeEventSource.close();
    }
    activeEventSource = new EventSource(`${apiBaseUrl}${POST_LIKES_STREAM_PATH}`);
    activeEventSource.addEventListener(POST_LIKES_CHANGED_EVENT_NAME, dispatchLikesChanged);
    activeEventSource.addEventListener(POST_CREATED_EVENT_NAME, dispatchPostCreated);
    activeEventSource.onerror = () => {
      if (activeEventSource) {
        activeEventSource.close();
        activeEventSource = null;
      }
      scheduleReconnect();
    };
    reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
  }

  /**
   * Subscribes to every community.post-likes-changed push, regardless of which post it names.
   *
   * @param {(event: { postId: string, likes: number, ownerId: string, likerId: string, likerName: string, liked: boolean }) => void} listener - Called for every push.
   * @returns {() => void} Unsubscribe function.
   */
  function subscribe(listener) {
    listeners.add(listener);
    return function unsubscribe() {
      listeners.delete(listener);
    };
  }

  /**
   * Subscribes to every community.post-created push on this same connection.
   *
   * @param {(post: object) => void} listener - Called with the newly created post (same shape
   *   GET /posts items have, author attached, likes 0).
   * @returns {() => void} Unsubscribe function.
   */
  function subscribeToPostCreated(listener) {
    postCreatedListeners.add(listener);
    return function unsubscribe() {
      postCreatedListeners.delete(listener);
    };
  }

  openStream();

  return { subscribe, subscribeToPostCreated };
}

export { createPostLikesStream };
