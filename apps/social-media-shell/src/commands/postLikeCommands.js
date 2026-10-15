/**
 * Toggles likes for the social media shell over the Event Mesh gateway.
 * Role: Publishes community-likes/toggle and waits for the gateway's targeted accepted/rejected
 *   reply, firing the liker's own "Post Liked" toast on an accepted like. A guest or the post's
 *   own author is rejected by the server; this command surfaces that as a quiet no-op rather
 *   than a toast, since the UI already disables the button for both cases.
 * Not in this file: appState.posts is NOT patched here on purpose — the gateway also
 *   broadcasts community-likes/changed to every client watching that post, including this one
 *   (each mounted post card already announced watching via
 *   @shared/community-events' publishPostLikesWatching), so src/main.js's global
 *   subscribeToCommunityLikesChanged listener applies that patch once for every viewer rather
 *   than this command patching it twice. The author's persisted toast comes from the inbox
 *   stream, since the owner is not the one making this request.
 * Key dependencies: event-mesh/mesh; ../notifications/notificationAdapter.js.
 * See also: src/main.js; src/events/communityLikesLiveEvents.js;
 *   apps/mock-data-service/src/event-mesh/postLikeHandler.js.
 */

import mesh from "event-mesh/mesh";
import { publishNotification } from "../notifications/notificationAdapter";

const COMMUNITY_LIKES_TOPIC = "community-likes";
const COMMUNITY_LIKES_TOGGLE_EVENT = "toggle";
const COMMUNITY_LIKES_ACCEPTED_EVENT = "accepted";
const COMMUNITY_LIKES_REJECTED_EVENT = "rejected";

const TOGGLE_TIMEOUT_MS = 15000;
const MESH_CONNECT_TIMEOUT_MS = 5000;

/** @type {{ requestId: string, resolve: (outcome: { ok: boolean, liked?: boolean, likes?: number, code?: string }) => void } | null} */
let pendingToggleWaiter = null;
let toggleListenersStarted = false;

function resolveToggleWaiter(outcome) {
  if (!pendingToggleWaiter) {
    return;
  }
  const resolveWaiter = pendingToggleWaiter.resolve;
  pendingToggleWaiter = null;
  resolveWaiter(outcome);
}

/**
 * Subscribes once to the accepted and rejected replies.
 *
 * @returns {void}
 * @sideEffects Registers mesh subscribers until resetPostLikeToggleListeners runs. The gateway
 *   targets each reply at the requesting client, so no further filtering by client is needed
 *   here; the requestId check only disambiguates two in-flight requests from this same tab.
 */
function ensurePostLikeToggleListeners() {
  if (toggleListenersStarted) {
    return;
  }
  toggleListenersStarted = true;
  mesh.subscribe(COMMUNITY_LIKES_TOPIC, COMMUNITY_LIKES_ACCEPTED_EVENT, (message) => {
    if (!pendingToggleWaiter || message.payload?.requestId !== pendingToggleWaiter.requestId) {
      return;
    }
    resolveToggleWaiter({
      ok: true,
      liked: message.payload.liked,
      likes: message.payload.likes,
    });
  });
  mesh.subscribe(COMMUNITY_LIKES_TOPIC, COMMUNITY_LIKES_REJECTED_EVENT, (message) => {
    if (!pendingToggleWaiter || message.payload?.requestId !== pendingToggleWaiter.requestId) {
      return;
    }
    resolveToggleWaiter({ ok: false, code: message.payload?.code || "request-failed" });
  });
}

/**
 * Clears toggle listener state so the next toggle re-subscribes after mesh.close().
 *
 * @returns {void}
 */
function resetPostLikeToggleListeners() {
  toggleListenersStarted = false;
  pendingToggleWaiter = null;
}

function waitForToggleOutcome(requestId) {
  return new Promise((resolve) => {
    const timeoutId = window.setTimeout(() => {
      if (pendingToggleWaiter?.requestId === requestId) {
        pendingToggleWaiter = null;
      }
      resolve({ ok: false, code: "timeout" });
    }, TOGGLE_TIMEOUT_MS);

    pendingToggleWaiter = {
      requestId,
      resolve: (outcome) => {
        window.clearTimeout(timeoutId);
        resolve(outcome);
      },
    };
  });
}

/**
 * Toggles the signed-in viewer's like on one post.
 *
 * @param {object} appState - Shell state holding the authenticated session.
 * @param {string} postId - Community post identifier from the community/post-liked intent.
 * @returns {Promise<void>}
 * @sideEffects Publishes community-likes/toggle and waits for the targeted reply; fires the
 *   "Post Liked" toast when the result is a like.
 */
async function toggleLikeForPost(appState, postId) {
  if (typeof postId !== "string" || postId.trim() === "" || !appState.authToken) {
    publishNotification({
      type: "error",
      title: "Sign in to like posts",
      message: "Please sign in and try again.",
    });
    return;
  }

  const requestId = `post-like-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  try {
    ensurePostLikeToggleListeners();
    await mesh.whenConnected({ timeoutMs: MESH_CONNECT_TIMEOUT_MS });

    const toggleOutcomePromise = waitForToggleOutcome(requestId);
    mesh.publish({
      topic: COMMUNITY_LIKES_TOPIC,
      event: COMMUNITY_LIKES_TOGGLE_EVENT,
      payload: { requestId, postId },
      scope: "distributed",
    });

    const toggleOutcome = await toggleOutcomePromise;
    if (toggleOutcome.ok && toggleOutcome.liked) {
      publishNotification({
        type: "success",
        title: "Post Liked",
        message: "You liked this post.",
      });
    }
  } catch (error) {
    console.warn("toggleLikeForPost - error");
    console.warn(error);
  }
}

export { resetPostLikeToggleListeners, toggleLikeForPost };
