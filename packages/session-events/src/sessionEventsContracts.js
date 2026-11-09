/**
 * Shared names for the session Event Mesh contract and the sign-out-everywhere HTTP route.
 * Role: Keeps the mesh client and the SSE session on the same topic, event, and path as the mock API.
 * Not in this file: The mesh publish/subscribe lifecycle or the HTTP write.
 * Key dependencies: None.
 * See also: apps/mock-data-service/src/event-mesh/sessionEventStream.js;
 *   apps/mock-data-service/src/routes/sessionRoutes.js.
 */

const SESSION_TOPIC = "session";
const SESSION_REVOKED_EVENT = "revoked";
const SESSION_REVOKED_EVENT_NAME = "session.revoked";
const SESSION_STREAM_PATH = "/auth/session-stream";
const SIGN_OUT_EVERYWHERE_PATH = "/auth/sign-out-everywhere";

export {
  SESSION_REVOKED_EVENT,
  SESSION_REVOKED_EVENT_NAME,
  SESSION_STREAM_PATH,
  SESSION_TOPIC,
  SIGN_OUT_EVERYWHERE_PATH,
};
