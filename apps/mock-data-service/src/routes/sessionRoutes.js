/**
 * Serves session management routes for the mock data service.
 * Role: Handles POST /auth/sign-out-everywhere, mounted at /api. The live push to this user's
 *   other open tabs travels over the event-mesh gateway, not this route.
 * Not in this file: Session revocation pure domain math, token formatting, or the gateway
 *   broadcast (src/event-mesh/sessionEventStream.js).
 * Key dependencies: sessionRevocations.json via jsonStore; src/domain/auth.js;
 *   src/domain/sessionRevocation.js; src/event-mesh/sessionEventStream.js.
 * See also: src/server.js.
 *   On main this route also exposes GET /auth/session-stream (Server-Sent Events); this branch
 *   has no stream endpoint, since every tab already carries a gateway connection.
 */

const express = require("express");
const { resolveAuthenticatedUserId } = require("../domain/auth");
const { revokeAllSessionsForUser } = require("../domain/sessionRevocation");

/**
 * Creates the session router.
 *
 * @param {{
 *   readJsonFileWithDefault: (fileName: string, defaultValue: any) => Promise<any>,
 *   writeJsonFile: (fileName: string, data: any) => Promise<void>
 * }} jsonStore - JSON file store bound to data directory.
 * @param {{ broadcastSessionRevoked: (userId: string) => void }} sessionEventStream - Publishes
 *   session/revoked to every open gateway socket.
 * @returns {import("express").Router} Express router mounted at /api.
 */
function createSessionRouter(jsonStore, sessionEventStream) {
  const router = express.Router();

  /**
   * POST /auth/sign-out-everywhere. Auth: Bearer token.
   * Revokes all active sessions for this user up to Date.now(), saves to sessionRevocations.json,
   * publishes session/revoked { userId } to every open gateway socket, and returns 204.
   */
  router.post("/auth/sign-out-everywhere", async (request, response) => {
    try {
      const sessionRevocations = await jsonStore.readJsonFileWithDefault("sessionRevocations.json", []);
      const authenticatedUserId = resolveAuthenticatedUserId(
        request.headers.authorization,
        sessionRevocations,
      );

      if (!authenticatedUserId) {
        response.status(401).json({ message: "Missing or invalid token" });
        return;
      }

      const revokedAt = Date.now();
      const updatedRevocations = revokeAllSessionsForUser(
        sessionRevocations,
        authenticatedUserId,
        revokedAt,
      );
      await jsonStore.writeJsonFile("sessionRevocations.json", updatedRevocations);

      sessionEventStream.broadcastSessionRevoked(authenticatedUserId);

      response.status(204).end();
    } catch (error) {
      console.error("POST /auth/sign-out-everywhere - error");
      console.error(error);
      response.status(500).json({
        message: "Unable to revoke sessions",
        details: error.message,
      });
    }
  });

  return router;
}

module.exports = { createSessionRouter };
