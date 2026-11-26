/**
 * Toggles the caller's like on one post and notifies every watcher.
 * Role: One use case for like toggles: user and post lookup, toggle, likes broadcast, and the
 *   author's inbox notification.
 * Not in this file: The toggle/count rule (src/domain/postLikes.js) or how a caller receives
 *   the outcome (HTTP status or gateway reply). The caller binds `streams.postLikes` to its own
 *   social and admin publishers.
 * Key dependencies: src/domain/postLikes.js; src/domain/notificationTriggers.js;
 *   src/domain/useCaseCodes.js.
 * See also: src/routes/postLikeRoutes.js (POST /posts/:postId/like).
 */

const { toggleLike } = require("./postLikes");
const { recordPostLikedNotification } = require("./notificationTriggers");
const {
  POST_NOT_FOUND_CODE,
  USER_NOT_FOUND_CODE,
  findUserById,
} = require("./useCaseCodes");

/**
 * Toggles one like.
 *
 * @param {{
 *   jsonStore: object,
 *   userId: string,
 *   payload: { postId?: unknown } | null | undefined,
 *   streams: {
 *     postLikes: { broadcastLikesChanged: (postId: string, payload: object) => void },
 *     notificationInbox?: { broadcastNotificationChanged: (userId: string, shell: string, notification: object) => void },
 *   },
 * }} toggleInput - Store, caller, target post, and broadcasters.
 * @returns {Promise<{ ok: true, result: { liked: boolean, likes: number } } | { ok: false, code: string }>} The new like state, or a failure code.
 * @sideEffects Writes postLikes.json and, on a like, notificationInbox.json; broadcasts.
 */
async function togglePostLike({ jsonStore, userId, payload, streams }) {
  const likerUser = await findUserById(jsonStore, userId);
  if (!likerUser) {
    return { ok: false, code: USER_NOT_FOUND_CODE };
  }

  const postsData = await jsonStore.readJsonFile("posts.json");
  const matchingPost = postsData.find((postRecord) => postRecord.id === payload?.postId);
  if (!matchingPost) {
    return { ok: false, code: POST_NOT_FOUND_CODE };
  }

  const toggleResult = await toggleLike({
    jsonStore,
    postId: matchingPost.id,
    userId: likerUser.id,
    authorId: matchingPost.authorId,
  });
  if (!toggleResult.ok) {
    return toggleResult;
  }

  const likerName = likerUser.fullName || likerUser.username;
  streams.postLikes.broadcastLikesChanged(matchingPost.id, {
    postId: matchingPost.id,
    likes: toggleResult.likes,
    ownerId: matchingPost.authorId,
    likerId: likerUser.id,
    likerName,
    liked: toggleResult.liked,
  });

  if (toggleResult.liked && streams.notificationInbox) {
    await recordPostLikedNotification({
      jsonStore,
      notificationInboxEventStream: streams.notificationInbox,
      post: matchingPost,
      likerName,
    });
  }

  return { ok: true, result: { liked: toggleResult.liked, likes: toggleResult.likes } };
}

module.exports = { togglePostLike };
