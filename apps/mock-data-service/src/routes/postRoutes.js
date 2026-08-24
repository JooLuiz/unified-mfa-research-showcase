/**
 * Serves post routes for the mock data service.
 * Role: Handles GET and POST /posts, mounted at /api.
 * Not in this file: Token helpers (src/domain/auth.js) or id generation (src/domain/identifiers.js).
 * Key dependencies: posts.json and users.json via the JSON store.
 * See also: src/server.js.
 */

const express = require("express");
const { buildPublicUser, extractUserIdFromToken } = require("../domain/auth");
const { generateIdentifier } = require("../domain/identifiers");

/**
 * Creates the post router.
 *
 * @param {{ readJsonFile: (fileName: string) => Promise<any>, writeJsonFile: (fileName: string, data: any) => Promise<void> }} jsonStore - JSON file store bound to the data directory.
 * @returns {import("express").Router} Router with the /posts routes.
 */
function createPostRouter(jsonStore) {
  const router = express.Router();

  router.get("/posts", async (_request, response) => {
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

      response.json({
        total: postsWithAuthor.length,
        items: postsWithAuthor,
      });
    } catch (error) {
      response.status(500).json({
        message: "Unable to load posts",
        details: error.message,
      });
    }
  });

  router.post("/posts", async (request, response) => {
    try {
      const userIdFromToken = extractUserIdFromToken(request.headers.authorization);
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

      response.status(201).json({
        ...newPost,
        author: buildPublicUser(matchingUser),
      });
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
