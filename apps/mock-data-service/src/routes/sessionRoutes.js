/**
 * Serves session management routes for the mock data service.
 * Role: Handles POST /auth/sign-out-everywhere and GET /auth/session-stream, mounted at /api.
 * Not in this file: Session revocation pure domain math or token formatting.
 * Key dependencies: sessionRevocations.json via jsonStore; src/domain/auth.js; src/domain/sessionRevocation.js.
 * See also: src/server.js.
 */

const express = require("express");
const { resolveAuthenticatedUserId } = require("../domain/auth");
const { revokeAllSessionsForUser } = require("../domain/sessionRevocation");
const { generateIdentifier } = require("../domain/identifiers");

const SESSION_SSE_HEARTBEAT_INTERVAL_MS = 20_000;

/**
 * Creates the session router.
 *
 * @param {{
 *   readJsonFileWithDefault: (fileName: string, defaultValue: any) => Promise<any>,
 *   writeJsonFile: (fileName: string, data: any) => Promise<void>
 * }} jsonStore - JSON file store bound to data directory.
 * @param {{
 *   rememberClient: (userId: string, clientId: string, response: import("express").Response) => void,
 *   forgetClient: (clientId: string) => void,
 *   broadcastSessionRevoked: (userId: string) => void
 * }} sessionEventStream - Per-user session SSE registry and broadcaster.
 * @returns {import("express").Router} Express router mounted at /api.
 */
function createSessionRouter(jsonStore, sessionEventStream) {
  const router = express.Router();

  /**
   * POST /auth/sign-out-everywhere. Auth: Bearer token.
   * Revokes all active sessions for this user up to Date.now(), saves to sessionRevocations.json,
   * broadcasts session.revoked to all open tabs for this user, and returns 204.
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

  /**
   * GET /auth/session-stream. Auth: Bearer token via Authorization header or ?token= query parameter.
   * Holds open an SSE stream that will receive `session.revoked` if this user signs out everywhere.
   */
  router.get("/auth/session-stream", async (request, response) => {
    const rawAuthHeader = request.headers.authorization;
    const tokenQuery = typeof request.query.token === "string" ? request.query.token : "";
    const authHeaderCandidate = rawAuthHeader || (tokenQuery ? `Bearer ${tokenQuery}` : "");

    const sessionRevocations = await jsonStore.readJsonFileWithDefault("sessionRevocations.json", []);
    const authenticatedUserId = resolveAuthenticatedUserId(
      authHeaderCandidate,
      sessionRevocations,
    );

    if (!authenticatedUserId) {
      response.status(401).json({ message: "Missing or invalid token" });
      return;
    }

    response.setHeader("Content-Type", "text/event-stream");
    response.setHeader("Cache-Control", "no-cache");
    response.setHeader("Connection", "keep-alive");
    response.flushHeaders();

    const clientId = generateIdentifier("session-client");
    sessionEventStream.rememberClient(authenticatedUserId, clientId, response);

    const heartbeatIntervalId = setInterval(() => {
      response.write(": ping\n\n");
    }, SESSION_SSE_HEARTBEAT_INTERVAL_MS);

    response.on("close", () => {
      clearInterval(heartbeatIntervalId);
      sessionEventStream.forgetClient(clientId);
    });
  });

  return router;
}

module.exports = { createSessionRouter };
