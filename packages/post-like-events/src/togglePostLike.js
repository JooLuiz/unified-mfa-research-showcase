/**
 * Toggles one post-like over the Event Mesh gateway and waits for the server's reply.
 * Role: Publishes community-likes/toggle and resolves with the accepted reply, or a rejection
 *   code from community-likes/rejected. A guest or the post's own author is rejected by the
 *   server; this command surfaces that as a rejection code rather than a toast, since the UI
 *   already disables the button for both cases.
 * Not in this file: The mesh subscription stream (src/createPostLikesStream.js).
 * Key dependencies: event-mesh/mesh; src/postLikeEventsContracts.js.
 * See also: apps/mock-data-service/src/event-mesh/postLikeHandler.js;
 *   apps/social-media-shell/src/commands/postLikeCommands.js.
 *   On main this module sends an HTTP POST; this branch publishes through mesh and waits for
 *   a targeted reply instead of an HTTP response.
 */

import mesh from "event-mesh/mesh";
import {
  COMMUNITY_LIKES_ACCEPTED_EVENT,
  COMMUNITY_LIKES_REJECTED_EVENT,
  COMMUNITY_LIKES_TOPIC,
  COMMUNITY_LIKES_TOGGLE_EVENT,
} from "./postLikeEventsContracts.js";

const TOGGLE_TIMEOUT_MS = 15_000;
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
 * @sideEffects Registers mesh subscribers until resetToggleListeners runs. The gateway
 *   targets each reply at the requesting client, so no further filtering by client is needed
 *   here; the requestId check only disambiguates two in-flight requests from this same tab.
 */
function ensureToggleListeners() {
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
function resetToggleListeners() {
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
 * Asks the server to toggle the caller's like on one post.
 *
 * @param {{ apiBaseUrl?: string, authToken: string, postId: string }} toggleInput - Bearer token and the post to like/unlike. `apiBaseUrl` is accepted for call-site compatibility and unused.
 * @returns {Promise<{ ok: true, liked: boolean, likes: number } | { ok: false, code: string }>} The resulting toggle state, or a rejection code.
 * @sideEffects Publishes community-likes/toggle and waits for the targeted reply.
 */
async function togglePostLike({ authToken, postId }) {
  if (!authToken) {
    return { ok: false, code: "unauthorized" };
  }

  const requestId = `post-like-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  try {
    ensureToggleListeners();
    await mesh.whenConnected({ timeoutMs: MESH_CONNECT_TIMEOUT_MS });

    const toggleOutcomePromise = waitForToggleOutcome(requestId);
    mesh.publish({
      topic: COMMUNITY_LIKES_TOPIC,
      event: COMMUNITY_LIKES_TOGGLE_EVENT,
      payload: { requestId, postId },
      scope: "distributed",
    });

    return await toggleOutcomePromise;
  } catch (error) {
    console.warn("togglePostLike - error");
    console.warn(error);
    return { ok: false, code: "network-error" };
  }
}

export { togglePostLike, resetToggleListeners };
