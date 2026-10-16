/**
 * Serves post routes for the mock data service.
 * Role: Handles GET and POST /posts, mounted at /api.
 * Not in this file: Token helpers (src/domain/auth.js), id generation
 *   (src/domain/identifiers.js), the admin broadcast implementation
 *   (src/infrastructure/adminEventStream.js), or the like toggle/stream
 *   (src/routes/postLikeRoutes.js, src/infrastructure/postLikeEventStream.js).
 * Key dependencies: posts.json and users.json via the JSON store; src/domain/postLikes.js.
 * See also: src/server.js; src/routes/adminRoutes.js (admin live-notifications stream).
 */

const express = require("express");
const { buildPublicUser, resolveAuthenticatedUserId } = require("../domain/auth");
const { generateIdentifier } = require("../domain/identifiers");
const { readPostLikesData, attachLikeCountsToPosts } = require("../domain/postLikes");
const { recordPostCreatedNotifications } = require("../domain/notificationTriggers");
const { POST_CREATED_EVENT_NAME } = require("../infrastructure/postLikeEventStream");

/**
 * Creates the post router.
 *
 * @param {{ readJsonFile: (fileName: string) => Promise<any>, writeJsonFile: (fileName: string, data: any) => Promise<void>, readJsonFileWithDefault: (fileName: string, defaultValue: any) => Promise<any> }} jsonStore - JSON file store bound to the data directory.
 * @param {{ broadcastEvent: (eventType: string, payload: object) => void }} adminEventStream - Broadcaster notified when a new post is created.
 * @param {{ broadcastEvent: (eventType: string, payload: object) => void }} postLikeEventStream - Social live-updates registry; reused here to push the new post to every open social tab, over the same connection likes already use.
 * @param {{ broadcastNotificationChanged: (userId: string, shell: string, notification: object) => void }} [notificationInboxEventStream] - Broadcaster for notification inbox rows.
 * @returns {import("express").Router} Router with the /posts routes.
 */
function createPostRouter(jsonStore, adminEventStream, postLikeEventStream, notificationInboxEventStream) {
  const router = express.Router();

  router.get("/posts", async (request, response) => {
    try {
      const postsData = await jsonStore.readJsonFile("posts.json");
      const usersData = await jsonStore.readJsonFile("users.json");
      const usersById = usersData.reduce((accumulator, userRecord) => {
        accumulator[userRecord.id] = buildPublicUser(userRecord);
        return accumulator;
      }, {});

      const postsWithAuthor = postsData
        .map((postRecord) => ({
          ...postRecord,
          author: usersById[postRecord.authorId] || null,
        }))
        .sort((firstPost, secondPost) =>
          new Date(secondPost.createdAt).getTime() - new Date(firstPost.createdAt).getTime(),
        );

      const postLikesData = await readPostLikesData(jsonStore);
      const sessionRevocations = await jsonStore.readJsonFileWithDefault("sessionRevocations.json", []);
      const viewerUserId = resolveAuthenticatedUserId(request.headers.authorization, sessionRevocations);
      const postsWithLikes = attachLikeCountsToPosts(postsWithAuthor, postLikesData, viewerUserId);

      response.json({
        total: postsWithLikes.length,
        items: postsWithLikes,
      });
    } catch (error) {
      response.status(500).json({
        message: "Unable to load posts",
        details: error.message,
      });
    }
  });

  router.get("/posts/:postId", async (request, response) => {
    try {
      const postsData = await jsonStore.readJsonFile("posts.json");
      const matchingPost = postsData.find((post) => post.id === request.params.postId);
      if (!matchingPost) {
        response.status(404).json({ message: "Post not found" });
        return;
      }

      const usersData = await jsonStore.readJsonFile("users.json");
      const authorRecord = usersData.find((userRecord) => userRecord.id === matchingPost.authorId);
      const postWithAuthor = {
        ...matchingPost,
        author: authorRecord ? buildPublicUser(authorRecord) : null,
      };

      const postLikesData = await readPostLikesData(jsonStore);
      const sessionRevocations = await jsonStore.readJsonFileWithDefault("sessionRevocations.json", []);
      const viewerUserId = resolveAuthenticatedUserId(request.headers.authorization, sessionRevocations);
      const [postWithLikes] = attachLikeCountsToPosts([postWithAuthor], postLikesData, viewerUserId);

      response.json(postWithLikes);
    } catch (error) {
      response.status(500).json({
        message: "Unable to load post",
        details: error.message,
      });
    }
  });

  router.post("/posts", async (request, response) => {
    try {
      const sessionRevocations = await jsonStore.readJsonFileWithDefault("sessionRevocations.json", []);
      const userIdFromToken = resolveAuthenticatedUserId(request.headers.authorization, sessionRevocations);
      if (!userIdFromToken) {
        response.status(401).json({ message: "Missing or invalid token" });
        return;
      }

      const usersData = await jsonStore.readJsonFile("users.json");
      const matchingUser = usersData.find(
        (userRecord) => userRecord.id === userIdFromToken,
      );
      if (!matchingUser) {
        response.status(404).json({ message: "User not found" });
        return;
      }

      const postPayload = request.body || {};
      const trimmedContent =
        typeof postPayload.content === "string" ? postPayload.content.trim() : "";
      if (!trimmedContent) {
        response.status(400).json({ message: "Post content is required" });
        return;
      }

      const trimmedImageUrl =
        typeof postPayload.imageUrl === "string" ? postPayload.imageUrl.trim() : "";

      const newPost = {
        id: generateIdentifier("post"),
        authorId: matchingUser.id,
        content: trimmedContent,
        imageUrl: trimmedImageUrl || null,
        createdAt: new Date().toISOString(),
        likes: 0,
        comments: 0,
      };

      const postsData = await jsonStore.readJsonFile("posts.json");
      const updatedPosts = [newPost, ...postsData];
      await jsonStore.writeJsonFile("posts.json", updatedPosts);

      const postWithAuthor = {
        ...newPost,
        author: buildPublicUser(matchingUser),
      };

      adminEventStream.broadcastEvent("post_created", postWithAuthor);
      postLikeEventStream.broadcastEvent(POST_CREATED_EVENT_NAME, postWithAuthor);

      if (notificationInboxEventStream) {
        await recordPostCreatedNotifications({
          jsonStore,
          notificationInboxEventStream,
          post: postWithAuthor,
        });
      }

      response.status(201).json(postWithAuthor);
    } catch (error) {
      response.status(500).json({
        message: "Unable to create post",
        details: error.message,
      });
    }
  });

  return router;
}

module.exports = { createPostRouter };
