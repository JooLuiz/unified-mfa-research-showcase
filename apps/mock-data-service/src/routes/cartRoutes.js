/**
 * Serves the authenticated user's saved cart for the mock data service.
 * Role: Handles GET /cart, mounted at /api. Cart replacement arrives on Event Mesh as cart-sync/upsert.
 * Not in this file: Cart persistence (src/domain/cartProcessing.js) or mesh publishing
 *   (src/event-mesh/cartUpsertHandler.js).
 * Key dependencies: carts.json via src/domain/cartProcessing.js; src/domain/auth.js.
 * See also: src/server.js.
 */

const express = require("express");
const { extractUserIdFromToken } = require("../domain/auth");
const { getCartForUser } = require("../domain/cartProcessing");

/**
 * Reads users.json and returns the user that matches the bearer token.
 *
 * @param {import("express").Request} request - Incoming request with an Authorization header.
 * @param {{ readJsonFile: (fileName: string) => Promise<Array<{ id: string }>> }} jsonStore - JSON file store.
 * @returns {Promise<{ userId: string } | { status: number, message: string }>} Authenticated user, or an HTTP error body.
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
  return { userId: matchingUser.id };
}

/**
 * Creates the cart router.
 *
 * @param {{ readJsonFile: (fileName: string) => Promise<unknown>, readJsonFileWithDefault: (fileName: string, defaultValue: unknown) => Promise<unknown> }} jsonStore - JSON file store bound to the data directory.
 * @returns {import("express").Router} Router with GET /cart.
 */
function createCartRouter(jsonStore) {
  const router = express.Router();

  /**
   * GET /cart. Auth: Bearer token. Output: the user's saved cart, or an empty cart when no row exists.
   */
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

  return router;
}

module.exports = { createCartRouter };
