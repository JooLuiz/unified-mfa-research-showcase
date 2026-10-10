/**
 * Public barrel for @shared/stock-events.
 * Role: Re-exports the guest session id helper, the mesh reservation commands, the shared
 *   watch client, and the insufficient-stock and guest-session-release-field constants.
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
  GUEST_STOCK_SESSION_RELEASE_FIELD,
} from "./stockEventsContracts.js";
