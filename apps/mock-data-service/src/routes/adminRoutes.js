/**
 * Serves admin-only read routes for the mock data service.
 * Role: Handles GET /admin/orders, GET /admin/posts, and the admin live-notifications SSE
 *   stream (POST /admin/connection-tickets + GET /admin/events), mounted at /api.
 * Not in this file: Token helpers (src/domain/auth.js), user-scoped routes, data mutation,
 *   or the broadcast implementation (src/infrastructure/adminEventStream.js).
 * Key dependencies: orders.json, posts.json, and users.json via the JSON store;
 *   src/domain/connectionTickets.js; src/infrastructure/adminEventStream.js.
 * See also: src/server.js; src/routes/orderRoutes.js and src/routes/postRoutes.js (broadcast producers).
 */

const express = require("express");
const { buildPublicUser, extractUserIdFromToken, isAdminUser } = require("../domain/auth");
const {
  buildConnectionRolesFromUserRole,
  issueConnectionTicket,
  consumeConnectionTicket,
} = require("../domain/connectionTickets");

const ADMIN_SSE_HEARTBEAT_INTERVAL_MS = 20_000;

/**
 * Creates the admin router.
 *
 * @param {{ readJsonFile: (fileName: string) => Promise<any>, readJsonFileWithDefault: (fileName: string, defaultValue: any) => Promise<any> }} jsonStore - JSON file store bound to the data directory.
 * @param {{ registerClient: (response: import("express").Response) => void, broadcastEvent: (eventType: string, payload: object) => void }} adminEventStream - Broadcaster for live admin events.
 * @returns {import("express").Router} Router with admin-only read routes and the live-notifications stream.
 */
function createAdminRouter(jsonStore, adminEventStream) {
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

  /**
   * POST /admin/connection-tickets. Auth: Bearer token with admin role. Output: a one-time
   * ticket the admin shell exchanges for an authenticated SSE connection, since EventSource
   * cannot send an Authorization header on the connecting request.
   */
  router.post("/admin/connection-tickets", async (request, response) => {
    try {
      const adminUser = await requireAdminUser(request, response);
      if (!adminUser) {
        return;
      }

      const ticket = issueConnectionTicket({
        userId: adminUser.id,
        roles: buildConnectionRolesFromUserRole(adminUser.role),
      });

      response.json({ ticket });
    } catch (error) {
      response.status(500).json({
        message: "Unable to issue connection ticket",
        details: error.message,
      });
    }
  });

  /**
   * GET /admin/events. Auth: one-time connection ticket issued by POST
   * /admin/connection-tickets, consumed here. Output: a Server-Sent Events stream of
   * `order_created` and `post_created` events broadcast by orderRoutes.js and postRoutes.js.
   */
  router.get("/admin/events", (request, response) => {
    const credential = consumeConnectionTicket(request.query.ticket);
    if (!credential || !credential.roles.includes("admin")) {
      response.status(401).json({ message: "Invalid or expired connection ticket" });
      return;
    }

    response.setHeader("Content-Type", "text/event-stream");
    response.setHeader("Cache-Control", "no-cache");
    response.setHeader("Connection", "keep-alive");
    response.flushHeaders();

    adminEventStream.registerClient(response);

    const heartbeatIntervalId = setInterval(() => {
      response.write(": ping\n\n");
    }, ADMIN_SSE_HEARTBEAT_INTERVAL_MS);

    response.on("close", () => {
      clearInterval(heartbeatIntervalId);
    });
  });

  return router;
}

module.exports = { createAdminRouter };
