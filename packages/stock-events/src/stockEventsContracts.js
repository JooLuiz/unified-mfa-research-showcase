/**
 * Shared constants for the live-stock HTTP + SSE transport.
 * Role: Route paths, header names, SSE event names, and the insufficient-stock code, used by
 *   both the reservation commands and the watch stream/client on this branch.
 * Not in this file: HTTP calls (src/stockReservationCommands.js) or the EventSource lifecycle
 *   (src/createStockWatchStream.js).
 * Key dependencies: None.
 * See also: apps/mock-data-service/src/routes/stockRoutes.js.
 */

const STOCK_RESERVATIONS_PATH = "/stock/reservations";
const STOCK_STREAM_PATH = "/stock/stream";
const STOCK_WATCHING_PATH = "/stock/watching";

const STOCK_SESSION_HEADER_NAME = "X-Stock-Session";

// Sent only by the ecommerce shell's login-merge PUT /cart call, so the server can delete the
// now-redundant guestHolds.json row for this session in the same request.
const STOCK_SESSION_RELEASE_HEADER_NAME = "X-Stock-Session-To-Release";

const STOCK_CHANGED_EVENT_NAME = "stock_changed";
const STOCK_STREAM_READY_EVENT_NAME = "stock_stream_ready";

const STOCK_INSUFFICIENT_CODE = "insufficient-stock";

export {
  STOCK_RESERVATIONS_PATH,
  STOCK_STREAM_PATH,
  STOCK_WATCHING_PATH,
  STOCK_SESSION_HEADER_NAME,
  STOCK_SESSION_RELEASE_HEADER_NAME,
  STOCK_CHANGED_EVENT_NAME,
  STOCK_STREAM_READY_EVENT_NAME,
  STOCK_INSUFFICIENT_CODE,
};
