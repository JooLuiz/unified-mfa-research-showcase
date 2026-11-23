/**
 * Public barrel for @shared/server-events.
 * Role: Re-exports the HTTP adapter, the shell composer, and ticket helper used by shell endpoint maps. The mesh branch replaces this package body at the same path.
 * Not in this file: Endpoint tables.
 * Key dependencies: src/createServerEvents.js; src/composeShellEvents.js; src/eventEndpoints.js.
 * See also: src/index.d.ts.
 */

export { createServerEvents } from "./createServerEvents.js";
export { composeShellEvents } from "./composeShellEvents.js";
export { exchangeTicket, bearerHeaders, readAcceptedOutcome } from "./eventEndpoints.js";
export { downloadCsvFile } from "./downloadCsvFile.js";
