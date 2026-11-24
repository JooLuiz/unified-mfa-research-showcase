/**
 * Public barrel for @shared/server-events.
 * Role: Re-exports the gateway adapter, the shell composer, the iframe window channel, and the helpers
 *   used by shell endpoint maps.
 *   main has an HTTP and EventSource body at this same path.
 * Not in this file: Endpoint tables.
 * Key dependencies: src/createServerEvents.js; src/composeShellEvents.js; src/createFrameMessageEvents.js;
 *   src/eventEndpoints.js.
 * See also: src/index.d.ts.
 *   main also exports exchangeTicket for SSE connection tickets; this branch has no SSE streams.
 */

export { createServerEvents } from "./createServerEvents.js";
export { composeShellEvents } from "./composeShellEvents.js";
export { createFrameMessageEvents } from "./createFrameMessageEvents.js";
export { bearerHeaders, readAcceptedOutcome, readJsonOutcome } from "./eventEndpoints.js";
export { downloadCsvFile } from "./downloadCsvFile.js";
