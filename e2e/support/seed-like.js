/**
 * Seeds a saved post like by appending to postLikes.json, so the same e2e spec works on
 * both the HTTP-like branch (main) and the Event-Mesh like branch (mesh).
 * Role: Test-only like seeder for specs that load a like after it already exists.
 * Not in this file: The live like a signed-in person clicks, or the notice that like creates.
 * Key dependencies: apps/mock-data-service/data/users.json; apps/mock-data-service/data/postLikes.json.
 * See also: e2e/support/reset-mock-data.js (must run before seedLike); e2e/support/seed-notification.js.
 */

const fs = require("fs/promises");
const path = require("path");

const DATA_DIRECTORY = path.resolve("apps/mock-data-service/data");

/**
 * Resolves a username to its user id by reading users.json.
 *
 * @param {string} username - Username to look up (e.g. "bruno.silva").
 * @returns {Promise<string>} The matching user id.
 * @throws {Error} When no user matches the username.
 */
async function resolveUserId(username) {
  const users = JSON.parse(
    await fs.readFile(path.join(DATA_DIRECTORY, "users.json"), "utf8"),
  );
  const matchingUser = users.find((userRecord) => userRecord.username === username);
  if (!matchingUser) {
    throw new Error(`seedLike - unknown username: ${username}`);
  }
  return matchingUser.id;
}

/**
 * Stores one user's like on one post when that pair is not already present.
 *
 * @param {string} username - Username who liked the post.
 * @param {string} postId - Post id (e.g. "post-03").
 * @returns {Promise<void>}
 * @sideEffects Writes apps/mock-data-service/data/postLikes.json. Must run after restoreMockData().
 */
async function seedLike(username, postId) {
  const userId = await resolveUserId(username);
  const likesPath = path.join(DATA_DIRECTORY, "postLikes.json");
  const likes = JSON.parse(await fs.readFile(likesPath, "utf8"));
  const alreadyLiked = likes.some(
    (likeRow) => likeRow.postId === postId && likeRow.userId === userId,
  );
  if (!alreadyLiked) {
    likes.push({ postId, userId });
  }
  await fs.writeFile(likesPath, `${JSON.stringify(likes, null, 2)}\n`, "utf8");
}

module.exports = { seedLike };
