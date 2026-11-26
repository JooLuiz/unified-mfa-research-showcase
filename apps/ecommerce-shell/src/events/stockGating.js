/**
 * Wires the shell's one persistent stock watch stream.
 * Role: Opens the tab's stock stream eagerly for the whole tab session and re-reserves guest cart
 *   lines after a reconnect.
 * Not in this file: Add-to-cart itself (src/intents/catalogIntentHandlers.js) or the
 *   reservation calls (src/utils/cartActions.js).
 * Key dependencies: @shared/stock-events; src/utils/cartActions.js; src/events/eventBus.js.
 * See also: src/main.js.
 */

import { createStockWatchClient } from "@shared/stock-events";
import { reReserveGuestCartLines } from "../utils/cartActions";
import { shellTransport } from "./eventBus";

/**
 * Starts the shell's persistent stock stream.
 *
 * @param {object} appState - Shell state holding cart items and an optional auth token.
 * @param {{ subscribe: Function, publish: Function }} [transport] - Event interface. Defaults to the shell singleton.
 * @returns {void}
 * @sideEffects Opens the tab's stock stream for the lifetime of the tab. A reconnect re-reserves guest lines.
 */
function startStockGating(appState, transport = shellTransport) {
  // Opened once, eagerly, independent of any component mount: a guest's hold is released
  // specifically when this tab's stock stream connection drops, so the stream must outlive
  // every page render.
  const stockWatchClient = createStockWatchClient(transport);
  stockWatchClient.subscribeToReconnect(() => {
    void reReserveGuestCartLines(appState);
  });
}

export { startStockGating };
