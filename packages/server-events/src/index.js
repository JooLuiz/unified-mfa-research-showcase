/**
 * Public barrel for @shared/server-events.
 * Role: Re-exports the HTTP adapter, the shell composer, the iframe window channel, the in-page channel, and ticket helper used by shell endpoint maps. The mesh branch replaces this package body at the same path.
 * Not in this file: Endpoint tables.
 * Key dependencies: src/createServerEvents.js; src/composeShellEvents.js; src/createFrameMessageEvents.js;
 *   src/eventEndpoints.js.
 * See also: src/index.d.ts.
 */

export { createServerEvents } from "./createServerEvents.js";
export { composeShellEvents } from "./composeShellEvents.js";
export { createFrameMessageEvents } from "./createFrameMessageEvents.js";
export { createPageEvents, isPageContract, pageEventName } from "./createPageEvents.js";
export {
  exchangeTicket,
  bearerHeaders,
  readAcceptedOutcome,
  readJsonOutcome,
} from "./eventEndpoints.js";
export { downloadCsvFile } from "./downloadCsvFile.js";
