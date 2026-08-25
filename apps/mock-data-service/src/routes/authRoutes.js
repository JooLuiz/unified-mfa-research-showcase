/**
 * Serves authentication routes for the mock data service.
 * Role: Handles POST /auth/login, mounted at /api.
 * Not in this file: Token parsing helpers (src/domain/auth.js) or user profile routes.
 * Key dependencies: users.json via the JSON store.
 * See also: src/server.js.
 */

const express = require("express");
const { buildPublicUser, buildAuthToken } = require("../domain/auth");

/**
 * Creates the authentication router.
 *
 * @param {{ readJsonFile: (fileName: string) => Promise<any> }} jsonStore - JSON file store bound to the data directory.
 * @returns {import("express").Router} Router with the login route.
 */
function createAuthRouter(jsonStore) {
  const router = express.Router();

  router.post("/auth/login", async (request, response) => {
    try {
      const { username, password } = request.body || {};
      const usersData = await jsonStore.readJsonFile("users.json");
      const matchingUser = usersData.find((userRecord) => {
        const usernameMatches =
          userRecord.username === username || userRecord.email === username;
        const passwordMatches = userRecord.password === password;
        return usernameMatches && passwordMatches;
      });

      if (!matchingUser) {
        response.status(401).json({ message: "Invalid credentials" });
        return;
      }

      response.json({
        token: buildAuthToken(matchingUser),
        user: buildPublicUser(matchingUser),
      });
    } catch (error) {
      response.status(500).json({
        message: "Unable to authenticate",
        details: error.message,
      });
    }
  });

  return router;
}

module.exports = { createAuthRouter };
