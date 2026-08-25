/**
 * Serves current-user routes for the mock data service.
 * Role: Handles GET and PUT /users/me, mounted at /api.
 * Not in this file: Login (src/routes/authRoutes.js) or token helpers (src/domain/auth.js).
 * Key dependencies: users.json via the JSON store.
 * See also: src/server.js.
 */

const express = require("express");
const { buildPublicUser, extractUserIdFromToken } = require("../domain/auth");

/**
 * Creates the current-user router.
 *
 * @param {{ readJsonFile: (fileName: string) => Promise<any>, writeJsonFile: (fileName: string, data: any) => Promise<void> }} jsonStore - JSON file store bound to the data directory.
 * @returns {import("express").Router} Router with the /users/me routes.
 */
function createUserRouter(jsonStore) {
  const router = express.Router();

  router.get("/users/me", async (request, response) => {
    try {
      const userIdFromToken = extractUserIdFromToken(request.headers.authorization);
      if (!userIdFromToken) {
        response.status(401).json({ message: "Missing or invalid token" });
        return;
      }
      const usersData = await jsonStore.readJsonFile("users.json");
      const matchingUser = usersData.find((userRecord) => userRecord.id === userIdFromToken);
      if (!matchingUser) {
        response.status(404).json({ message: "User not found" });
        return;
      }
      response.json(buildPublicUser(matchingUser));
    } catch (error) {
      response.status(500).json({
        message: "Unable to load current user",
        details: error.message,
      });
    }
  });

  router.put("/users/me", async (request, response) => {
    try {
      const userIdFromToken = extractUserIdFromToken(request.headers.authorization);
      if (!userIdFromToken) {
        response.status(401).json({ message: "Missing or invalid token" });
        return;
      }
      const usersData = await jsonStore.readJsonFile("users.json");
      const matchingUserIndex = usersData.findIndex(
        (userRecord) => userRecord.id === userIdFromToken,
      );
      if (matchingUserIndex === -1) {
        response.status(404).json({ message: "User not found" });
        return;
      }

      const matchingUser = usersData[matchingUserIndex];
      const updatePayload = request.body || {};

      if (typeof updatePayload.fullName === "string") {
        matchingUser.fullName = updatePayload.fullName;
      }
      if (typeof updatePayload.gender === "string") {
        matchingUser.gender = updatePayload.gender;
      }
      if (updatePayload.address && typeof updatePayload.address === "object") {
        matchingUser.address = {
          ...matchingUser.address,
          ...updatePayload.address,
        };
      }

      usersData[matchingUserIndex] = matchingUser;
      await jsonStore.writeJsonFile("users.json", usersData);

      response.json(buildPublicUser(matchingUser));
    } catch (error) {
      response.status(500).json({
        message: "Unable to update user",
        details: error.message,
      });
    }
  });

  return router;
}

module.exports = { createUserRouter };
