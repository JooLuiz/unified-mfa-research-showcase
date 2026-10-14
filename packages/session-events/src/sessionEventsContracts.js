/**
 * Shared names for the session Event Mesh contract and the sign-out-everywhere HTTP route.
 * Role: Keeps this package's mesh client on the same topic/event names as the mock data
 *   service's session broadcast, and the sign-out-everywhere command on the same path.
 * Not in this file: The mesh publish/subscribe lifecycle or the HTTP write.
 * Key dependencies: None.
 * See also: apps/mock-data-service/src/event-mesh/sessionEventStream.js;
 *   apps/mock-data-service/src/routes/sessionRoutes.js.
 */

const SESSION_TOPIC = "session";
const SESSION_REVOKED_EVENT = "revoked";
const SIGN_OUT_EVERYWHERE_PATH = "/auth/sign-out-everywhere";

export {
  SESSION_TOPIC,
  SESSION_REVOKED_EVENT,
  SIGN_OUT_EVERYWHERE_PATH,
};
