/**
 * Owns the per-user post-like rule shared by every post read and the toggle write.
 * Role: Computes a post's live like count and whether a given viewer has liked it, and applies
 *   the toggle rule (an author may never like their own post).
 * Not in this file: The mesh toggle/watch handler (src/event-mesh/postLikeHandler.js), HTTP
 *   post reads (src/routes/postRoutes.js, src/routes/adminRoutes.js), or the per-post watcher
 *   registry (src/infrastructure/postLikeEventStream.js).
 * Key dependencies: postLikes.json via the JSON store.
 * See also: src/event-mesh/postLikeHandler.js; src/domain/exportProcessing.js (posts CSV export).
 */

const POST_LIKES_FILE_NAME = "postLikes.json";
const LIKE_NOT_ALLOWED_CODE = "cannot-like-own-post";

/**
 * Reads every stored like row, defaulting to an empty list for a fresh data directory.
 *
 * @param {{ readJsonFileWithDefault: (fileName: string, defaultValue: any) => Promise<any> }} jsonStore - JSON file store bound to the data directory.
 * @returns {Promise<Array<{ postId: string, userId: string }>>} Every stored like row.
 */
async function readPostLikesData(jsonStore) {
  return jsonStore.readJsonFileWithDefault(POST_LIKES_FILE_NAME, []);
}

/**
 * Counts how many rows exist for one post.
 *
 * @param {Array<{ postId: string, userId: string }>} postLikesData - Every stored like row.
 * @param {string} postId - Post to count.
 * @returns {number} Live like count.
 */
function getLikeCountForPost(postLikesData, postId) {
  return postLikesData.filter((likeRow) => likeRow.postId === postId).length;
}

/**
 * Reports whether a given user has a like row for a given post.
 *
 * @param {Array<{ postId: string, userId: string }>} postLikesData - Every stored like row.
 * @param {string} postId - Post to check.
 * @param {string} userId - Viewer to check.
 * @returns {boolean} True when that user has already liked that post.
 */
function hasUserLikedPost(postLikesData, postId, userId) {
  return postLikesData.some(
    (likeRow) => likeRow.postId === postId && likeRow.userId === userId,
  );
}

/**
 * Annotates each post with its live like count, and with `likedByCurrentUser` when a viewer
 * is known.
 *
 * @param {object[]} posts - Posts to annotate (already carrying their author, if any).
 * @param {Array<{ postId: string, userId: string }>} postLikesData - Every stored like row.
 * @param {string | null | undefined} viewerUserId - Authenticated viewer, or null/undefined for a guest.
 * @returns {object[]} Posts with `likes` always set, and `likedByCurrentUser` set only when `viewerUserId` is present.
 */
function attachLikeCountsToPosts(posts, postLikesData, viewerUserId) {
  return posts.map((post) => ({
    ...post,
    likes: getLikeCountForPost(postLikesData, post.id),
    ...(viewerUserId
      ? { likedByCurrentUser: hasUserLikedPost(postLikesData, post.id, viewerUserId) }
      : {}),
  }));
}

/**
 * Toggles one user's like on one post. An author can never like their own post.
 *
 * @param {{ jsonStore: object, postId: string, userId: string, authorId: string }} toggleInput - Store, the post and user ids, and the post's author id.
 * @returns {Promise<{ ok: true, liked: boolean, likes: number } | { ok: false, code: string }>} The resulting toggle state, or a rejection code.
 * @sideEffects On success, writes postLikes.json.
 */
async function toggleLike({ jsonStore, postId, userId, authorId }) {
  if (userId === authorId) {
    return { ok: false, code: LIKE_NOT_ALLOWED_CODE };
  }

  const postLikesData = await readPostLikesData(jsonStore);
  const existingRowIndex = postLikesData.findIndex(
    (likeRow) => likeRow.postId === postId && likeRow.userId === userId,
  );

  const liked = existingRowIndex < 0;
  const nextPostLikesData = liked
    ? [...postLikesData, { postId, userId }]
    : [
        ...postLikesData.slice(0, existingRowIndex),
        ...postLikesData.slice(existingRowIndex + 1),
      ];

  await jsonStore.writeJsonFile(POST_LIKES_FILE_NAME, nextPostLikesData);

  return { ok: true, liked, likes: getLikeCountForPost(nextPostLikesData, postId) };
}

module.exports = {
  POST_LIKES_FILE_NAME,
  LIKE_NOT_ALLOWED_CODE,
  readPostLikesData,
  getLikeCountForPost,
  hasUserLikedPost,
  attachLikeCountsToPosts,
  toggleLike,
};
