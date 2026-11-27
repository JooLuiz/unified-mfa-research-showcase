/**
 * Public barrel for @shared/server-events.
 * Role: Re-exports the gateway adapter, the shell composer, the iframe window channel, the in-page
 *   channel, and the helpers used by shell endpoint maps.
 *   main has an HTTP and EventSource body at this same path.
 * Not in this file: Endpoint tables.
 * Key dependencies: src/createServerEvents.js; src/composeShellEvents.js; src/createFrameMessageEvents.js;
 *   src/eventEndpoints.js.
 * See also: src/index.d.ts.
 *   main also exports exchangeTicket for SSE connection tickets; this branch has no SSE streams.
 *   main also exports isPageContract and pageEventName for its window-event shells.
 */

export { createServerEvents } from "./createServerEvents.js";
export { composeShellEvents } from "./composeShellEvents.js";
export { createFrameMessageEvents } from "./createFrameMessageEvents.js";
export { createPageEvents } from "./createPageEvents.js";
export { bearerHeaders, readAcceptedOutcome, readJsonOutcome } from "./eventEndpoints.js";
export { downloadCsvFile } from "./downloadCsvFile.js";
