/**
 * Verifies live like counts and the rule that an author cannot like their own post.
 * Role: Exercises postLikes with an in-memory JSON store.
 * Not in this file: HTTP routing or the like SSE stream.
 * Key dependencies: node:test; src/domain/postLikes.js.
 * See also: src/domain/postLikes.js.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  LIKE_NOT_ALLOWED_CODE,
  attachLikeCountsToPosts,
  getLikeCountForPost,
  hasUserLikedPost,
  toggleLike,
} = require("./postLikes");

/**
 * Creates a JSON store whose files live in memory.
 *
 * @param {Record<string, unknown>} initialFiles - File name to stored JSON value.
 * @returns {{ readJsonFile: (fileName: string) => Promise<unknown>, readJsonFileWithDefault: (fileName: string, defaultValue: unknown) => Promise<unknown>, writeJsonFile: (fileName: string, data: unknown) => Promise<void>, files: Record<string, unknown> }} In-memory store.
 */
function createMemoryJsonStore(initialFiles) {
  const files = structuredClone(initialFiles);
  return {
    files,
    async readJsonFile(fileName) {
      if (!Object.prototype.hasOwnProperty.call(files, fileName)) {
        const missingFileError = new Error(`Missing ${fileName}`);
        missingFileError.code = "ENOENT";
        throw missingFileError;
      }
      return structuredClone(files[fileName]);
    },
    async readJsonFileWithDefault(fileName, defaultValue) {
      try {
        return await this.readJsonFile(fileName);
      } catch (error) {
        if (error && error.code === "ENOENT") {
          return structuredClone(defaultValue);
        }
        throw error;
      }
    },
    async writeJsonFile(fileName, data) {
      files[fileName] = structuredClone(data);
    },
  };
}

const storedLikes = [
  { postId: "post-01", userId: "u-02" },
  { postId: "post-01", userId: "u-03" },
  { postId: "post-02", userId: "u-02" },
];

test("getLikeCountForPost and hasUserLikedPost read the stored like rows", () => {
  assert.equal(getLikeCountForPost(storedLikes, "post-01"), 2);
  assert.equal(getLikeCountForPost(storedLikes, "post-09"), 0);
  assert.equal(hasUserLikedPost(storedLikes, "post-01", "u-02"), true);
  assert.equal(hasUserLikedPost(storedLikes, "post-01", "u-09"), false);
});

test("attachLikeCountsToPosts sets likedByCurrentUser only for a known viewer", () => {
  const posts = [{ id: "post-01", likes: 99 }];
  const guestView = attachLikeCountsToPosts(posts, storedLikes, null);
  const viewerView = attachLikeCountsToPosts(posts, storedLikes, "u-02");

  assert.equal(guestView[0].likes, 2);
  assert.equal(Object.hasOwn(guestView[0], "likedByCurrentUser"), false);
  assert.equal(viewerView[0].likes, 2);
  assert.equal(viewerView[0].likedByCurrentUser, true);
});

test("toggleLike rejects the author and then adds and removes another user's like", async () => {
  const jsonStore = createMemoryJsonStore({ "postLikes.json": [] });
  const authorAttempt = await toggleLike({
    jsonStore,
    postId: "post-01",
    userId: "u-01",
    authorId: "u-01",
  });
  assert.equal(authorAttempt.ok, false);
  assert.equal(authorAttempt.code, LIKE_NOT_ALLOWED_CODE);
  assert.equal(jsonStore.files["postLikes.json"].length, 0);

  const liked = await toggleLike({
    jsonStore,
    postId: "post-01",
    userId: "u-02",
    authorId: "u-01",
  });
  assert.deepEqual(liked, { ok: true, liked: true, likes: 1 });

  const unliked = await toggleLike({
    jsonStore,
    postId: "post-01",
    userId: "u-02",
    authorId: "u-01",
  });
  assert.deepEqual(unliked, { ok: true, liked: false, likes: 0 });
  assert.deepEqual(jsonStore.files["postLikes.json"], []);
});
