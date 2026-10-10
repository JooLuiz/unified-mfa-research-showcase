/**
 * Public barrel for @shared/stock-events.
 * Role: Re-exports the guest session id helper, the low-level reservation commands, the shared
 *   watch client, and the insufficient-stock code constant.
 * Not in this file: Implementations (see the sibling modules).
 * Key dependencies: src/guestStockSession.js; src/stockReservationCommands.js;
 *   src/createStockWatchClient.js; src/stockEventsContracts.js.
 * See also: src/index.d.ts.
 */

export { getOrCreateGuestStockSessionId } from "./guestStockSession.js";
export { reserveStockQuantity, setStockQuantity } from "./stockReservationCommands.js";
export { createStockWatchClient } from "./createStockWatchClient.js";
export {
  STOCK_INSUFFICIENT_CODE,
  STOCK_SESSION_RELEASE_HEADER_NAME,
} from "./stockEventsContracts.js";
