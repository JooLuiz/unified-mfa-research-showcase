/**
 * Shared contracts and event names for the session stream.
 * Role: Centralizes topic and event names across shells.
 * Not in this file: Paths (packages/server-events/src/eventEndpoints.js), the live connection, or
 *   shell state. Both live behind the injected transport.
 * Key dependencies: None.
 * See also: src/createSessionSession.js, src/sessionRevocationCommands.js.
 */

const SESSION_TOPIC = "session";
const SESSION_REVOKED_EVENT = "revoked";
const SESSION_REVOKED_EVENT_NAME = "session.revoked";

export {
  SESSION_TOPIC,
  SESSION_REVOKED_EVENT,
  SESSION_REVOKED_EVENT_NAME,
};
