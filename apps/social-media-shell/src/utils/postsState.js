/**
 * Idempotent insert into appState.posts.
 * Role: Single idempotent insert used by both the author's own optimistic insert
 *   (src/commands/postCommands.js) and the live post-created push (src/main.js), since the
 *   server broadcasts post-created to every open tab including the post's own author, and the
 *   HTTP response and the SSE push can arrive in either order. Without this guard, whichever
 *   one arrives second would prepend the same post again, producing a duplicate React key.
 * Not in this file: The HTTP command or the SSE subscription themselves.
 * Key dependencies: None.
 * See also: src/commands/postCommands.js; src/main.js.
 */

/**
 * Adds a post to appState.posts unless a post with that id is already present.
 *
 * @param {object} appState - Shell state holding the live posts array.
 * @param {object} post - Post to add if not already present.
 * @returns {void}
 * @sideEffects Replaces appState.posts with a new array when the post was not already present.
 */
function addPostIfMissing(appState, post) {
  const alreadyPresent = appState.posts.some((existingPost) => existingPost.id === post.id);
  if (alreadyPresent) {
    return;
  }
  appState.posts = [post, ...appState.posts];
}

export { addPostIfMissing };
