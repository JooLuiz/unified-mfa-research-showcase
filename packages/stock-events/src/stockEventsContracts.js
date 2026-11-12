/**
 * Shared constants for the live-stock Event Mesh transport and the HTTP/SSE paths.
 * Role: Topic, event names, reservation codes, and stream paths used by the watch client and the SSE session.
 * Not in this file: Mesh publish/subscribe calls (src/createStockWatchClient.js) or reservation
 *   request/reply handling (src/stockReservationCommands.js).
 * Key dependencies: None.
 * See also: apps/mock-data-service/src/inbound/stockHandler.js;
 *   apps/mock-data-service/src/infrastructure/stockEvents.js.
 */

const STOCK_RESERVATIONS_PATH = "/stock/reservations";
const STOCK_STREAM_PATH = "/stock/stream";
const STOCK_WATCHING_PATH = "/stock/watching";

const STOCK_SESSION_HEADER_NAME = "X-Stock-Session";

// Sent only by the ecommerce shell's login-merge PUT /cart call, so the server can delete the
// now-redundant guestHolds.json row for this session in the same request.
const STOCK_SESSION_RELEASE_HEADER_NAME = "X-Stock-Session-To-Release";

const STOCK_TOPIC = "stock";
const STOCK_WATCHING_EVENT = "watching";
const STOCK_RESERVE_EVENT = "reserve";
const STOCK_RELEASE_EVENT = "release";
const STOCK_ACCEPTED_EVENT = "accepted";
const STOCK_REJECTED_EVENT = "rejected";
const STOCK_CHANGED_EVENT = "changed";
const STOCK_CHANGED_EVENT_NAME = "stock_changed";
const STOCK_STREAM_READY_EVENT_NAME = "stock_stream_ready";

const STOCK_INSUFFICIENT_CODE = "insufficient-stock";

// Payload field name the ecommerce shell sets on a login-merge cart-sync/upsert, naming the
// guest stock session whose guestHolds.json row the server should delete. Matches
// GUEST_STOCK_SESSION_RELEASE_FIELD in
// apps/mock-data-service/src/inbound/cartUpsertHandler.js.
const GUEST_STOCK_SESSION_RELEASE_FIELD = "guestStockSessionIdToRelease";

export {
  GUEST_STOCK_SESSION_RELEASE_FIELD,
  STOCK_ACCEPTED_EVENT,
  STOCK_CHANGED_EVENT,
  STOCK_CHANGED_EVENT_NAME,
  STOCK_INSUFFICIENT_CODE,
  STOCK_RELEASE_EVENT,
  STOCK_REJECTED_EVENT,
  STOCK_RESERVATIONS_PATH,
  STOCK_RESERVE_EVENT,
  STOCK_SESSION_HEADER_NAME,
  STOCK_SESSION_RELEASE_HEADER_NAME,
  STOCK_STREAM_PATH,
  STOCK_STREAM_READY_EVENT_NAME,
  STOCK_TOPIC,
  STOCK_WATCHING_EVENT,
  STOCK_WATCHING_PATH,
};
