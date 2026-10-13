/**
 * Serves the post-like toggle and the social live-updates stream for the mock data service.
 * Role: Handles POST /posts/:postId/like and GET /posts/stream, mounted at /api.
 * Not in this file: Like count/toggle rule (src/domain/postLikes.js), the social SSE registry
 *   (src/infrastructure/postLikeEventStream.js), or the admin SSE registry
 *   (src/infrastructure/adminEventStream.js, reused here for the admin broadcast side).
 * Key dependencies: posts.json and users.json via the JSON store; src/domain/auth.js;
 *   src/domain/postLikes.js.
 * See also: src/server.js; src/routes/postRoutes.js (GET /posts annotates `likes` from the
 *   same domain module); src/routes/adminRoutes.js (GET /admin/posts, same annotation).
 */

const express = require("express");
const { extractUserIdFromToken } = require("../domain/auth");
const { LIKE_NOT_ALLOWED_CODE, toggleLike } = require("../domain/postLikes");
const { POST_LIKES_CHANGED_EVENT_NAME } = require("../infrastructure/postLikeEventStream");

const POST_LIKES_SSE_HEARTBEAT_INTERVAL_MS = 20_000;

/**
 * Creates the post-like router.
 *
 * @param {{ readJsonFile: (fileName: string) => Promise<any>, readJsonFileWithDefault: (fileName: string, defaultValue: any) => Promise<any>, writeJsonFile: (fileName: string, data: any) => Promise<void> }} jsonStore - JSON file store bound to the data directory.
 * @param {{ registerClient: (response: import("express").Response) => void, broadcastLikesChanged: (payload: object) => void }} postLikeEventStream - Broadcaster for every open social tab.
 * @param {{ broadcastEvent: (eventType: string, payload: object) => void }} adminEventStream - Existing admin broadcaster, reused for the admin table's live Likes column.
 * @returns {import("express").Router} Router with the toggle endpoint and the social live-updates stream.
 */
function createPostLikeRouter(jsonStore, postLikeEventStream, adminEventStream) {
  const router = express.Router();

  /**
   * POST /posts/:postId/like. Auth: Bearer. Toggles the caller's like on one post. Rejects
   * when the caller is the post's author. On success, broadcasts the new state to every open
   * social tab and every open admin tab, and returns the caller's own accept/reject.
   */
  router.post("/posts/:postId/like", async (request, response) => {
    try {
      const userIdFromToken = extractUserIdFromToken(request.headers.authorization);
      if (!userIdFromToken) {
        response.status(401).json({ message: "Missing or invalid token" });
        return;
      }

      const usersData = await jsonStore.readJsonFile("users.json");
      const likerUser = usersData.find((userRecord) => userRecord.id === userIdFromToken);
      if (!likerUser) {
        response.status(404).json({ message: "User not found" });
        return;
      }

      const postsData = await jsonStore.readJsonFile("posts.json");
      const matchingPost = postsData.find(
        (postRecord) => postRecord.id === request.params.postId,
      );
      if (!matchingPost) {
        response.status(404).json({ message: "Post not found" });
        return;
      }

      const toggleResult = await toggleLike({
        jsonStore,
        postId: matchingPost.id,
        userId: likerUser.id,
        authorId: matchingPost.authorId,
      });
      if (!toggleResult.ok) {
        if (toggleResult.code === LIKE_NOT_ALLOWED_CODE) {
          response.status(403).json({
            message: "You cannot like your own post",
            code: toggleResult.code,
          });
          return;
        }
        response.status(500).json({ message: "Unable to toggle like", code: toggleResult.code });
        return;
      }

      const likeChangedPayload = {
        postId: matchingPost.id,
        likes: toggleResult.likes,
        ownerId: matchingPost.authorId,
        likerId: likerUser.id,
        likerName: likerUser.fullName || likerUser.username,
        liked: toggleResult.liked,
      };
      postLikeEventStream.broadcastLikesChanged(likeChangedPayload);
      adminEventStream.broadcastEvent(POST_LIKES_CHANGED_EVENT_NAME, likeChangedPayload);

      response.json({ liked: toggleResult.liked, likes: toggleResult.likes });
    } catch (error) {
      response.status(500).json({
        message: "Unable to toggle like",
        details: error.message,
      });
    }
  });

  /**
   * GET /posts/stream. No auth: signed-in and guest social tabs connect the same way, since
   * the live like count is public information and EventSource cannot send an Authorization
   * header anyway. Output: a Server-Sent Events stream of community.post-likes-changed.
   */
  router.get("/posts/stream", (_request, response) => {
    response.setHeader("Content-Type", "text/event-stream");
    response.setHeader("Cache-Control", "no-cache");
    response.setHeader("Connection", "keep-alive");
    response.flushHeaders();

    postLikeEventStream.registerClient(response);

    const heartbeatIntervalId = setInterval(() => {
      response.write(": ping\n\n");
    }, POST_LIKES_SSE_HEARTBEAT_INTERVAL_MS);

    response.on("close", () => {
      clearInterval(heartbeatIntervalId);
    });
  });

  return router;
}

module.exports = { createPostLikeRouter };
