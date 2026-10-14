/**
 * Shared contracts and event names for the session stream.
 * Role: Centralizes topic/event names and endpoints across shells.
 * Not in this file: EventSource connection or shell state.
 * Key dependencies: None.
 * See also: src/createSessionStreamSession.js, src/sessionRevocationCommands.js.
 */

const SESSION_REVOKED_EVENT_NAME = "session.revoked";
const SESSION_STREAM_PATH = "/auth/session-stream";
const SIGN_OUT_EVERYWHERE_PATH = "/auth/sign-out-everywhere";

export {
  SESSION_REVOKED_EVENT_NAME,
  SESSION_STREAM_PATH,
  SIGN_OUT_EVERYWHERE_PATH,
};
