/**
 * Re-establishes a guest shopper's stock holds when the local (unauthenticated) mesh session
 * starts.
 * Role: Called once each time the shell opens a guest mesh connection — on first load and after
 *   logout — to re-send every guest cart line's stock hold, since a client that has not yet
 *   connected (or whose socket just reconnected) has no hold recorded on the server.
 * Not in this file: The reservation mesh calls themselves (src/utils/cartActions.js) or
 *   add-to-cart gating, which the mesh catalog intent handler in src/main.js owns directly by
 *   calling addCartItemWithStockCheck.
 * Key dependencies: src/utils/cartActions.js.
 * See also: src/main.js.
 */

import { reReserveGuestCartLines } from "../utils/cartActions";

/**
 * Re-sends every guest cart line's stock hold for the newly (re)started local mesh session.
 *
 * @param {object} appState - Shell state holding cart items; a no-op for signed-in shoppers.
 * @returns {void}
 * @sideEffects See reReserveGuestCartLines.
 */
function startStockGating(appState) {
  void reReserveGuestCartLines(appState);
}

export { startStockGating };
