/**
 * Sends one post-like toggle through the injected transport.
 * Role: Asks the server to like or unlike one post for the signed-in caller.
 * Not in this file: The live like subscription (src/createPostLikesSession.js).
 * Key dependencies: The caller supplies the transport.
 * See also: apps/social-media-shell/src/commands/postLikeCommands.js.
 */

/**
 * Asks the server to toggle the caller's like on one post.
 *
 * @param {{ request: Function }} transport - Event interface.
 * @param {{ postId: string }} toggleInput - Post to like or unlike.
 * @returns {Promise<{ ok: true, liked: boolean, likes: number } | { ok: false, code: string }>} The resulting toggle state, or a rejection code.
 * @sideEffects Sends community-likes/toggle.
 */
function togglePostLike(transport, { postId }) {
  return transport.request({
    topic: "community-likes",
    event: "toggle",
    payload: { postId },
  });
}

export { togglePostLike };
