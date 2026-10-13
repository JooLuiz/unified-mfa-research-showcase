/**
 * Manages the social shell's live post-like mesh subscription.
 * Role: Fans community-likes/changed out to any number of local listeners, without exposing
 *   mesh timing constraints to callers. Unlike cartLiveEvents.js/adminLiveEvents.js, this
 *   module does not publish its own watching announce: each mounted post card already
 *   announces community-likes/watching per post id directly
 *   (@shared/community-events' publishPostLikesWatching, the same per-entity-watch shape as
 *   @shared/stock-events' createStockWatchClient), so there is nothing session-wide to
 *   re-announce here.
 * Not in this file: The watching announce (packages/community-events, published per-card on
 *   mount) or the like-toggle request/reply (src/commands/postLikeCommands.js).
 * Key dependencies: event-mesh/mesh.
 * See also: src/main.js (start from the authenticated mesh session, stop on downgrade);
 *   apps/ecommerce-shell/src/events/cartLiveEvents.js (same ensure/reset shape).
 */

import mesh from "event-mesh/mesh";

const COMMUNITY_LIKES_TOPIC = "community-likes";
const COMMUNITY_LIKES_CHANGED_EVENT = "changed";
const MESH_CONNECT_TIMEOUT_MS = 5000;

let liveEventsGeneration = 0;
let unsubscribeFromMeshLikesChanged = null;
let isStartInFlight = false;

/** @type {Set<(payload: { postId: string, likes: number, ownerId: string, likerId: string, likerName: string, liked: boolean }) => void>} */
const listeners = new Set();

/**
 * Calls every registered listener with one pushed like change.
 *
 * @param {{ postId: string, likes: number, ownerId: string, likerId: string, likerName: string, liked: boolean }} payload - community-likes/changed payload.
 * @returns {void}
 */
function notifyListeners(payload) {
  listeners.forEach((listener) => listener(payload));
}

/**
 * Starts the community-likes/changed mesh subscription. Safe to call for guests too: like
 * counts are public, so a guest viewing the feed still receives live updates even though
 * liking itself requires signing in.
 *
 * @returns {Promise<void>}
 * @sideEffects Subscribes to community-likes/changed once the mesh client is connected.
 */
async function startCommunityLikesLiveEvents() {
  if (unsubscribeFromMeshLikesChanged || isStartInFlight) {
    return;
  }

  const generation = ++liveEventsGeneration;
  isStartInFlight = true;
  try {
    await mesh.whenConnected({ timeoutMs: MESH_CONNECT_TIMEOUT_MS });
    if (generation !== liveEventsGeneration) {
      return;
    }
    unsubscribeFromMeshLikesChanged = mesh.subscribe(
      COMMUNITY_LIKES_TOPIC,
      COMMUNITY_LIKES_CHANGED_EVENT,
      (message) => {
        notifyListeners(message.payload);
      },
    );
  } catch (error) {
    console.warn("startCommunityLikesLiveEvents - error");
    console.warn(error);
  } finally {
    if (generation === liveEventsGeneration) {
      isStartInFlight = false;
    }
  }
}

/**
 * Stops the mesh subscription without closing the mesh client.
 *
 * @returns {void}
 * @sideEffects Removes the community-likes/changed mesh subscription.
 */
function stopCommunityLikesLiveEvents() {
  liveEventsGeneration += 1;
  isStartInFlight = false;

  if (unsubscribeFromMeshLikesChanged) {
    unsubscribeFromMeshLikesChanged();
    unsubscribeFromMeshLikesChanged = null;
  }
}

/**
 * Registers a local listener for like changes pushed on community-likes/changed.
 *
 * Safe to call at any time, including before the mesh session starts: this only adds to an
 * in-memory registry and never touches the mesh client directly, so it cannot trigger
 * EventMesh's lazy singleton ahead of configureMesh().
 *
 * @param {(payload: { postId: string, likes: number, ownerId: string, likerId: string, likerName: string, liked: boolean }) => void} listener - Called with each community-likes/changed payload.
 * @returns {() => void} Removes this listener from the registry.
 * @sideEffects Mutates the module-local listener registry.
 */
function subscribeToCommunityLikesChanged(listener) {
  listeners.add(listener);
  return function unsubscribeFromCommunityLikesChanged() {
    listeners.delete(listener);
  };
}

/**
 * Applies one community-likes/changed payload to a posts array.
 *
 * The public `likes` count is patched for every viewer. `likedByCurrentUser` is patched only
 * when this viewer is the payload's `likerId` — everyone else's own like/unlike state of that
 * post hasn't changed, and the broadcast has no way to carry a per-viewer flag for every other
 * watcher at once.
 *
 * @param {object[]} posts - Posts array to patch (not mutated).
 * @param {string | null | undefined} viewerUserId - Current viewer's id, or null/undefined for a guest.
 * @param {{ postId: string, likes: number, likerId: string, liked: boolean }} payload - community-likes/changed payload.
 * @returns {object[]} New posts array with the matching post patched.
 */
function applyLikesChangeToPosts(posts, viewerUserId, payload) {
  return posts.map((post) =>
    post.id === payload.postId
      ? {
          ...post,
          likes: payload.likes,
          ...(viewerUserId && payload.likerId === viewerUserId
            ? { likedByCurrentUser: payload.liked }
            : {}),
        }
      : post,
  );
}

export {
  startCommunityLikesLiveEvents,
  stopCommunityLikesLiveEvents,
  subscribeToCommunityLikesChanged,
  applyLikesChangeToPosts,
};
