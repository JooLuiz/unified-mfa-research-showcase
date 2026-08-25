/**
 * Serves admin-only read routes for the mock data service.
 * Role: Handles GET /admin/orders and GET /admin/posts, mounted at /api, returning all users' records.
 * Not in this file: Token helpers (src/domain/auth.js), user-scoped routes, or data mutation.
 * Key dependencies: orders.json, posts.json, and users.json via the JSON store.
 * See also: src/server.js.
 */

const express = require("express");
const { buildPublicUser, extractUserIdFromToken, isAdminUser } = require("../domain/auth");

/**
 * Creates the admin router.
 *
 * @param {{ readJsonFile: (fileName: string) => Promise<any>, readJsonFileWithDefault: (fileName: string, defaultValue: any) => Promise<any> }} jsonStore - JSON file store bound to the data directory.
 * @returns {import("express").Router} Router with admin-only read routes.
 */
function createAdminRouter(jsonStore) {
  const router = express.Router();

  async function requireAdminUser(request, response) {
    const userIdFromToken = extractUserIdFromToken(request.headers.authorization);
    if (!userIdFromToken) {
      response.status(401).json({ message: "Missing or invalid token" });
      return null;
    }

    const usersData = await jsonStore.readJsonFile("users.json");
    const matchingUser = usersData.find(
      (userRecord) => userRecord.id === userIdFromToken,
    );
    if (!matchingUser) {
      response.status(404).json({ message: "User not found" });
      return null;
    }
    if (!isAdminUser(matchingUser)) {
      response.status(403).json({ message: "Admin access required" });
      return null;
    }
    return matchingUser;
  }

  function buildUsersById(usersData) {
    return usersData.reduce((accumulator, userRecord) => {
      accumulator[userRecord.id] = buildPublicUser(userRecord);
      return accumulator;
    }, {});
  }

  /**
   * GET /admin/orders. Auth: Bearer token with admin role. Output: every order with its customer embedded.
   */
  router.get("/admin/orders", async (request, response) => {
    try {
      const adminUser = await requireAdminUser(request, response);
      if (!adminUser) {
        return;
      }

      const ordersData = await jsonStore.readJsonFileWithDefault("orders.json", []);
      const usersData = await jsonStore.readJsonFile("users.json");
      const usersById = buildUsersById(usersData);

      const ordersWithCustomer = ordersData
        .map((orderRecord) => ({
          ...orderRecord,
          customer: usersById[orderRecord.userId] || null,
        }))
        .sort((firstOrder, secondOrder) =>
          new Date(secondOrder.placedAt).getTime() - new Date(firstOrder.placedAt).getTime(),
        );

      response.json({
        total: ordersWithCustomer.length,
        items: ordersWithCustomer,
      });
    } catch (error) {
      response.status(500).json({
        message: "Unable to load all orders",
        details: error.message,
      });
    }
  });

  /**
   * GET /admin/posts. Auth: Bearer token with admin role. Output: every post with its author embedded.
   */
  router.get("/admin/posts", async (request, response) => {
    try {
      const adminUser = await requireAdminUser(request, response);
      if (!adminUser) {
        return;
      }

      const postsData = await jsonStore.readJsonFile("posts.json");
      const usersData = await jsonStore.readJsonFile("users.json");
      const usersById = buildUsersById(usersData);

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
        message: "Unable to load all posts",
        details: error.message,
      });
    }
  });

  return router;
}

module.exports = { createAdminRouter };
