/**
 * Shared constants for the live-stock Event Mesh transport.
 * Role: Topic, event names, and the insufficient-stock code, used by both the watch client and
 *   the reservation commands on this branch.
 * Not in this file: Mesh publish/subscribe calls (src/createStockWatchClient.js) or reservation
 *   request/reply handling (src/stockReservationCommands.js).
 * Key dependencies: None.
 * See also: apps/mock-data-service/src/event-mesh/stockHandler.js;
 *   apps/mock-data-service/src/infrastructure/stockEventStream.js.
 */

const STOCK_TOPIC = "stock";
const STOCK_WATCHING_EVENT = "watching";
const STOCK_RESERVE_EVENT = "reserve";
const STOCK_RELEASE_EVENT = "release";
const STOCK_ACCEPTED_EVENT = "accepted";
const STOCK_REJECTED_EVENT = "rejected";
const STOCK_CHANGED_EVENT = "changed";

const STOCK_INSUFFICIENT_CODE = "insufficient-stock";

// Payload field name the ecommerce shell sets on a login-merge cart-sync/upsert, naming the
// guest stock session whose guestHolds.json row the server should delete. Matches
// GUEST_STOCK_SESSION_RELEASE_FIELD in
// apps/mock-data-service/src/event-mesh/cartUpsertHandler.js.
const GUEST_STOCK_SESSION_RELEASE_FIELD = "guestStockSessionIdToRelease";

export {
  STOCK_TOPIC,
  STOCK_WATCHING_EVENT,
  STOCK_RESERVE_EVENT,
  STOCK_RELEASE_EVENT,
  STOCK_ACCEPTED_EVENT,
  STOCK_REJECTED_EVENT,
  STOCK_CHANGED_EVENT,
  STOCK_INSUFFICIENT_CODE,
  GUEST_STOCK_SESSION_RELEASE_FIELD,
};
