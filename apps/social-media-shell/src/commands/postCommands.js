/**
 * Persists new posts for the social media shell.
 * Role: Owns the post HTTP command and reports failures through the shell notifier.
 * Not in this file: New-post form mounting or feed rendering (src/pages/postsPage.js, src/pages/feedPage.js).
 * Key dependencies: Mock data service POST /api/posts; src/notifications/notificationAdapter.js.
 * See also: src/pages/postsPage.js.
 */

import { MOCK_API_BASE_URL } from "../utils/constants";
import fetchJson from "../utils/fetchJson";
import { publishNotification } from "../notifications/notificationAdapter";
import { addPostIfMissing } from "../utils/postsState";

/**
 * Persists a new post and retains the current feed when the command fails.
 *
 * @param {object} appState - Shell state containing the authenticated session and posts.
 * @param {object} postPayload - Content values accepted by the post endpoint.
 * @returns {Promise<{ ok: boolean, post?: object }>} Created post result.
 * @sideEffects Adds the created post to shell state and emits a local failure notification.
 */
async function persistNewPost(appState, postPayload) {
  if (!appState.authToken) {
    publishNotification({
      type: "error",
      title: "Post not published",
      message: "Please sign in and try again.",
    });
    return { ok: false };
  }
  try {
    const createdPost = await fetchJson(`${MOCK_API_BASE_URL}/posts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${appState.authToken}`,
      },
      body: JSON.stringify(postPayload),
    });
    // Guarded (not a raw prepend): the server's live post-created push (src/main.js) reaches
    // this same tab too, and the HTTP response here and that SSE push can arrive in either
    // order, so whichever runs second must not insert the post a second time.
    addPostIfMissing(appState, createdPost);
    return { ok: true, post: createdPost };
  } catch (error) {
    console.warn("persistNewPost - error");
    console.warn(error);
    publishNotification({
      type: "error",
      title: "Post not published",
      message: "Your post was not saved. Please try again.",
    });
    return { ok: false };
  }
}

export { persistNewPost };
