/**
 * Handles a member's like, author, and new-post requests from the post remotes.
 * Role: One place for the outcome of each community request. Pages call these from remote
 *   callback props, and a shell may also register them as intent listeners.
 * Not in this file: How a request reaches the shell, or the like and post HTTP details.
 * Key dependencies: src/commands/postLikeCommands.js; src/commands/postCommands.js;
 *   src/utils/authActions.js; src/notifications/notificationAdapter.js; src/events/eventBus.js.
 * See also: src/pages/feedPage.js; src/pages/postsPage.js; src/pages/accountPage.js.
 */

import { publishRenderRequested } from "../events/eventBus";
import { isAuthenticated } from "../utils/authActions";
import { publishNotification } from "../notifications/notificationAdapter";
import { persistNewPost } from "../commands/postCommands";
import { toggleLikeForPost } from "../commands/postLikeCommands";

/**
 * Creates the community request handlers for one shell state.
 *
 * @param {object} transport - Shell transport passed to the like and post commands.
 * @param {object} appState - Shell state holding session and posts.
 * @param {{ notify?: (notification: object) => void, requestRender?: () => void }} [dependencies]
 *   - Toast and re-render functions. They default to the shell's own.
 * @returns {{
 *   onPostLiked: (payload: { postId: string }) => Promise<unknown>,
 *   onAuthorSelected: (payload: { author?: object }) => void,
 *   onPostSubmitted: (payload: { content: string, imageUrl?: string }) => Promise<{ ok: boolean } | undefined>,
 * }} Handlers.
 */
function createCommunityIntentHandlers(
  transport,
  appState,
  { notify = publishNotification, requestRender = publishRenderRequested } = {},
) {
  return {
    onPostLiked({ postId }) {
      const likedPost = (appState.posts || []).find((post) => post.id === postId);
      return toggleLikeForPost(transport, appState, likedPost);
    },
    onAuthorSelected() {
      // Author profiles are not a route yet, so selecting an author changes nothing.
    },
    async onPostSubmitted(payload) {
      if (!isAuthenticated(appState)) {
        return undefined;
      }
      const postResult = await persistNewPost(transport, appState, {
        content: payload.content,
        imageUrl: payload.imageUrl,
        authorId: appState.currentUser?.id,
      });
      if (postResult.ok) {
        notify({
          type: "success",
          title: "Post published",
          message: "Your post is now visible in the community feed.",
        });
        requestRender();
      }
      return postResult;
    },
  };
}

export { createCommunityIntentHandlers };
