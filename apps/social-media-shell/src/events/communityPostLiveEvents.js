/**
 * Manages the social shell's live post-created mesh subscription.
 * Role: Announces this connection on community-posts/watching and fans
 *   community-posts/created out to any number of local listeners, without exposing mesh
 *   timing constraints to callers. Unlike communityLikesLiveEvents.js (per-post watching,
 *   announced by each mounted post card), a new post isn't scoped to one post id, so this
 *   module owns its own session-wide watching announce, re-sent on an interval the same way
 *   cartLiveEvents.js/adminLiveEvents.js do.
 * Not in this file: Inserting the pushed post into appState.posts (src/main.js,
 *   src/utils/postsState.js) or mesh session open/close (src/main.js).
 * Key dependencies: event-mesh/mesh.
 * See also: src/main.js (start from every mesh session, stop on downgrade);
 *   apps/ecommerce-shell/src/events/cartLiveEvents.js (same ensure/reset shape).
 */

import mesh from "event-mesh/mesh";

const COMMUNITY_POSTS_TOPIC = "community-posts";
const COMMUNITY_POSTS_WATCHING_EVENT = "watching";
const COMMUNITY_POSTS_CREATED_EVENT = "created";
const WATCHING_ANNOUNCE_INTERVAL_MS = 10_000;
const MESH_CONNECT_TIMEOUT_MS = 5000;

let liveEventsGeneration = 0;
let unsubscribeFromMeshPostCreated = null;
let watchingIntervalId = null;
let isStartInFlight = false;

/** @type {Set<(post: object) => void>} */
const listeners = new Set();

/**
 * Calls every registered listener with one pushed post.
 *
 * @param {object} post - community-posts/created payload (post record with its author).
 * @returns {void}
 */
function notifyListeners(post) {
  listeners.forEach((listener) => listener(post));
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
 * Starts the watching announce and the mesh subscription.
 *
 * @returns {Promise<void>}
 * @sideEffects Publishes community-posts/watching on an interval and subscribes to
 *   community-posts/created.
 */
async function startCommunityPostLiveEvents() {
  if (unsubscribeFromMeshPostCreated || isStartInFlight) {
    return;
  }

  const generation = ++liveEventsGeneration;
  isStartInFlight = true;
  try {
    await mesh.whenConnected({ timeoutMs: MESH_CONNECT_TIMEOUT_MS });
    if (generation !== liveEventsGeneration) {
      return;
    }

    publishWatchingAnnounce();
    unsubscribeFromMeshPostCreated = mesh.subscribe(
      COMMUNITY_POSTS_TOPIC,
      COMMUNITY_POSTS_CREATED_EVENT,
      (message) => {
        notifyListeners(message.payload);
      },
    );
    watchingIntervalId = window.setInterval(
      publishWatchingAnnounce,
      WATCHING_ANNOUNCE_INTERVAL_MS,
    );
  } catch (error) {
    console.warn("startCommunityPostLiveEvents - error");
    console.warn(error);
  } finally {
    if (generation === liveEventsGeneration) {
      isStartInFlight = false;
    }
  }
}

/**
 * Stops the watching announce and the mesh subscription without closing the mesh client.
 *
 * @returns {void}
 * @sideEffects Clears the watching interval and removes the mesh subscription.
 */
function stopCommunityPostLiveEvents() {
  liveEventsGeneration += 1;
  isStartInFlight = false;

  if (watchingIntervalId) {
    window.clearInterval(watchingIntervalId);
    watchingIntervalId = null;
  }

  if (unsubscribeFromMeshPostCreated) {
    unsubscribeFromMeshPostCreated();
    unsubscribeFromMeshPostCreated = null;
  }
}

/**
 * Registers a local listener for posts pushed on community-posts/created.
 *
 * Safe to call at any time, including before the mesh session starts: this only adds to an
 * in-memory registry and never touches the mesh client directly, so it cannot trigger
 * EventMesh's lazy singleton ahead of configureMesh().
 *
 * @param {(post: object) => void} listener - Called with each community-posts/created payload.
 * @returns {() => void} Removes this listener from the registry.
 * @sideEffects Mutates the module-local listener registry.
 */
function subscribeToPostCreated(listener) {
  listeners.add(listener);
  return function unsubscribeFromPostCreated() {
    listeners.delete(listener);
  };
}

export { startCommunityPostLiveEvents, stopCommunityPostLiveEvents, subscribeToPostCreated };
