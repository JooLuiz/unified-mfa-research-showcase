/**
 * Serves the authenticated user's cart for the mock data service.
 * Role: Handles GET /cart, PUT /cart, and the per-user cart SSE stream, mounted at /api.
 * Not in this file: Cart persistence (src/domain/cartProcessing.js) or the stream map
 *   (src/infrastructure/cartEventStream.js).
 * Key dependencies: carts.json via src/domain/cartProcessing.js; src/domain/auth.js;
 *   src/domain/connectionTickets.js.
 * See also: src/server.js; src/routes/orderRoutes.js.
 */

const express = require("express");
const { extractUserIdFromToken } = require("../domain/auth");
const {
  buildConnectionRolesFromUserRole,
  consumeConnectionTicket,
  issueConnectionTicket,
} = require("../domain/connectionTickets");
const {
  CART_REQUEST_INVALID_CODE,
  getCartForUser,
  saveCartForUser,
} = require("../domain/cartProcessing");

const CART_SSE_HEARTBEAT_INTERVAL_MS = 20_000;

/**
 * Reads users.json and returns the user that matches the bearer token.
 *
 * @param {import("express").Request} request - Incoming request with an Authorization header.
 * @param {{ readJsonFile: (fileName: string) => Promise<Array<{ id: string, role?: string }>> }} jsonStore - JSON file store.
 * @returns {Promise<{ userId: string, role?: string } | { status: number, message: string }>} Authenticated user, or an HTTP error body.
 */
async function resolveAuthenticatedUser(request, jsonStore) {
  const userIdFromToken = extractUserIdFromToken(request.headers.authorization);
  if (!userIdFromToken) {
    return { status: 401, message: "Missing or invalid token" };
  }
  const usersData = await jsonStore.readJsonFile("users.json");
  const matchingUser = usersData.find((userRecord) => userRecord.id === userIdFromToken);
  if (!matchingUser) {
    return { status: 404, message: "User not found" };
  }
  return { userId: matchingUser.id, role: matchingUser.role };
}

/**
 * Creates the cart router.
 *
 * @param {{ readJsonFile: (fileName: string) => Promise<any>, readJsonFileWithDefault: (fileName: string, defaultValue: any) => Promise<any>, writeJsonFile: (fileName: string, data: any) => Promise<void> }} jsonStore - JSON file store bound to the data directory.
 * @param {{ registerClient: (userId: string, response: import("express").Response) => void, writeCartChanged: (response: import("express").Response, cart: object) => void, broadcastCartChanged: (userId: string, cart: object) => void }} cartEventStream - Per-user cart SSE broadcaster.
 * @returns {import("express").Router} Router with the cart HTTP routes and the live cart stream.
 */
function createCartRouter(jsonStore, cartEventStream) {
  const router = express.Router();

  router.get("/cart", async (request, response) => {
    try {
      const authenticatedUser = await resolveAuthenticatedUser(request, jsonStore);
      if (authenticatedUser.status) {
        response.status(authenticatedUser.status).json({ message: authenticatedUser.message });
        return;
      }

      const cartResult = await getCartForUser({
        jsonStore,
        userId: authenticatedUser.userId,
      });
      if (!cartResult.ok) {
        response.status(500).json({ message: "Unable to load cart" });
        return;
      }
      response.json(cartResult.cart);
    } catch (error) {
      response.status(500).json({
        message: "Unable to load cart",
        details: error.message,
      });
    }
  });

  router.put("/cart", async (request, response) => {
    try {
      const authenticatedUser = await resolveAuthenticatedUser(request, jsonStore);
      if (authenticatedUser.status) {
        response.status(authenticatedUser.status).json({ message: authenticatedUser.message });
        return;
      }

      const cartResult = await saveCartForUser({
        jsonStore,
        userId: authenticatedUser.userId,
        cartPayload: request.body || {},
      });
      if (!cartResult.ok) {
        if (cartResult.code === CART_REQUEST_INVALID_CODE) {
          response.status(400).json({ message: "Cart items are invalid" });
          return;
        }
        response.status(500).json({ message: "Unable to save cart" });
        return;
      }
      cartEventStream.broadcastCartChanged(authenticatedUser.userId, cartResult.cart);
      response.json(cartResult.cart);
    } catch (error) {
      response.status(500).json({
        message: "Unable to save cart",
        details: error.message,
      });
    }
  });

  /**
   * POST /cart/connection-tickets. Auth: any Bearer token. Output: a one-time ticket for
   * GET /cart/events, because EventSource cannot send an Authorization header.
   */
  router.post("/cart/connection-tickets", async (request, response) => {
    try {
      const authenticatedUser = await resolveAuthenticatedUser(request, jsonStore);
      if (authenticatedUser.status) {
        response.status(authenticatedUser.status).json({ message: authenticatedUser.message });
        return;
      }

      const ticket = issueConnectionTicket({
        userId: authenticatedUser.userId,
        roles: buildConnectionRolesFromUserRole(authenticatedUser.role),
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
   * GET /cart/events. Auth: one-time ticket from POST /cart/connection-tickets.
   * Output: a Server-Sent Events stream of cart_changed for that ticket's user only.
   * The first frame is the user's current cart.
   */
  router.get("/cart/events", async (request, response) => {
    const credential = consumeConnectionTicket(request.query.ticket);
    if (!credential?.userId) {
      response.status(401).json({ message: "Invalid or expired connection ticket" });
      return;
    }

    response.setHeader("Content-Type", "text/event-stream");
    response.setHeader("Cache-Control", "no-cache");
    response.setHeader("Connection", "keep-alive");
    response.flushHeaders();
    cartEventStream.registerClient(credential.userId, response);

    const heartbeatIntervalId = setInterval(() => {
      response.write(": ping\n\n");
    }, CART_SSE_HEARTBEAT_INTERVAL_MS);
    response.on("close", () => {
      clearInterval(heartbeatIntervalId);
    });

    try {
      const cartResult = await getCartForUser({
        jsonStore,
        userId: credential.userId,
      });
      const currentCart = cartResult.ok
        ? cartResult.cart
        : { items: [], appliedCoupon: null, updatedAt: null };
      cartEventStream.writeCartChanged(response, currentCart);
    } catch (error) {
      console.error("GET /cart/events - error");
      console.error(error);
    }
  });

  return router;
}

module.exports = { createCartRouter };
