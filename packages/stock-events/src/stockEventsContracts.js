/**
 * Shared constants for the live-stock contract.
 * Role: Header names, topic and event names, and the insufficient-stock code, used by both the
 *   reservation commands and the watch client.
 * Not in this file: Paths (packages/server-events/src/eventEndpoints.js), or the requests and the
 *   live connection. Both live behind the injected transport.
 * Key dependencies: None.
 * See also: main: apps/mock-data-service/src/routes/stockRoutes.js;
 *   mesh: apps/mock-data-service/src/inbound/stockHandler.js.
 */


const STOCK_SESSION_HEADER_NAME = "X-Stock-Session";

// Sent only by the ecommerce shell's login-merge PUT /cart call, so the server can delete the
// now-redundant guestHolds.json row for this session in the same request.
const STOCK_SESSION_RELEASE_HEADER_NAME = "X-Stock-Session-To-Release";

const STOCK_TOPIC = "stock";
const STOCK_CHANGED_EVENT = "changed";
const STOCK_CHANGED_EVENT_NAME = "stock_changed";
const STOCK_STREAM_READY_EVENT_NAME = "stock_stream_ready";

const STOCK_INSUFFICIENT_CODE = "insufficient-stock";

export {
  STOCK_SESSION_HEADER_NAME,
  STOCK_SESSION_RELEASE_HEADER_NAME,
  STOCK_TOPIC,
  STOCK_CHANGED_EVENT,
  STOCK_CHANGED_EVENT_NAME,
  STOCK_STREAM_READY_EVENT_NAME,
  STOCK_INSUFFICIENT_CODE,
};
