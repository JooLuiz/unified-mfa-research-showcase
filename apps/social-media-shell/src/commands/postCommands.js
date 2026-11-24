/**
 * Persists new posts for the social media shell.
 * Role: Owns the post create command and reports failures through the shell notifier.
 * Not in this file: New-post form mounting or feed rendering (src/pages/postsPage.js, src/pages/feedPage.js).
 * Key dependencies: An injected shell transport (community-posts:create); src/notifications/notificationAdapter.js.
 * See also: src/pages/postsPage.js.
 */

import { publishNotification } from "../notifications/notificationAdapter";
import { addPostIfMissing } from "../utils/postsState";

const COMMUNITY_POSTS_TOPIC = "community-posts";
const POST_CREATE_EVENT = "create";

/**
 * Persists a new post and retains the current feed when the command fails.
 *
 * @param {{ request: (message: { topic: string, event: string, payload?: object }) => Promise<{ ok: boolean, post?: object, code?: string }> }} transport - Shell transport that runs the post create request.
 * @param {object} appState - Shell state containing the authenticated session and posts.
 * @param {object} postPayload - Content values accepted by the post create request.
 * @returns {Promise<{ ok: boolean, post?: object }>} Created post result.
 * @sideEffects Requests community-posts:create, adds the created post to shell state, and emits a local failure notification.
 */
async function persistNewPost(transport, appState, postPayload) {
  if (!appState.authToken) {
    publishNotification({
      type: "error",
      title: "Post not published",
      message: "Please sign in and try again.",
    });
    return { ok: false };
  }

  const outcome = await transport.request({
    topic: COMMUNITY_POSTS_TOPIC,
    event: POST_CREATE_EVENT,
    payload: { authToken: appState.authToken, post: postPayload },
  });
  if (!outcome.ok) {
    publishNotification({
      type: "error",
      title: "Post not published",
      message: "Your post was not saved. Please try again.",
    });
    return { ok: false };
  }

  // Guarded (not a raw prepend): the server's live post-created push (src/main.js) reaches
  // this same tab too, and the request reply here and that push can arrive in either
  // order, so whichever runs second must not insert the post a second time.
  addPostIfMissing(appState, outcome.post);
  return { ok: true, post: outcome.post };
}

export { persistNewPost };
