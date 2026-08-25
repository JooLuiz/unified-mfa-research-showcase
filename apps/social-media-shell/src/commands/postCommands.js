/**
 * Persists new posts for the social media shell.
 * Role: Owns the post HTTP command and reports failures through the shell notifier.
 * Not in this file: New-post form mounting or feed rendering (src/pages/postsPage.js, src/pages/feedPage.js).
 * Key dependencies: Mock data service POST /api/posts; src/notifications/notificationBus.js.
 * See also: src/pages/postsPage.js.
 */

import { MOCK_API_BASE_URL } from "../utils/constants";
import fetchJson from "../utils/fetchJson";
import { notify } from "../notifications/notificationBus";

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
    notify({
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
    appState.posts = [createdPost, ...appState.posts];
    return { ok: true, post: createdPost };
  } catch (error) {
    console.warn("persistNewPost - error");
    console.warn(error);
    notify({
      type: "error",
      title: "Post not published",
      message: "Your post was not saved. Please try again.",
    });
    return { ok: false };
  }
}

export { persistNewPost };
