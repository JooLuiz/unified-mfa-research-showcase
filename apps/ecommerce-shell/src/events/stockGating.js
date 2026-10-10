/**
 * Wires the shell's one persistent stock watch stream and the stock-gated add-to-cart flow.
 * Role: Opens the tab's stock stream eagerly for the whole tab session, re-reserves guest cart
 *   lines after a reconnect, and gates add-to-cart requests behind a stock reservation call.
 * Not in this file: The reservation HTTP calls themselves (src/utils/cartActions.js) or the
 *   watch client/stream mechanics (@shared/stock-events).
 * Key dependencies: @shared/stock-events; src/utils/cartActions.js; src/events/eventBus.js.
 * See also: src/main.js.
 */

import { createStockWatchClient } from "@shared/stock-events";
import {
  STOCK_ISSUE_NOTIFICATION_MESSAGE,
  addCartItemWithStockCheck,
  reReserveGuestCartLines,
} from "../utils/cartActions";
import { MOCK_API_BASE_URL } from "../utils/constants";
import { subscribeToCartItemAddRequests } from "./eventBus";
import { publishNotification } from "../notifications/notificationAdapter";

/**
 * Starts the shell's persistent stock stream and gates add-to-cart requests behind it.
 *
 * @param {object} appState - Shell state holding cart items, products, and an optional auth token.
 * @returns {void}
 * @sideEffects Opens the tab's stock stream and subscribes to cart-item-add requests for the
 *   lifetime of the tab; neither is ever torn down, matching the stream's own lifetime.
 */
function startStockGating(appState) {
  // Opened once, eagerly, independent of any component mount: a guest's hold is released
  // specifically when this tab's stock stream connection drops, so the stream must outlive
  // every page render.
  const stockWatchClient = createStockWatchClient({ apiBaseUrl: MOCK_API_BASE_URL });
  stockWatchClient.subscribeToReconnect(() => {
    void reReserveGuestCartLines(appState);
  });

  subscribeToCartItemAddRequests(async (event) => {
    const payload = event.detail;
    if (!payload || !payload.productId) {
      return;
    }

    const incomingQuantity = Number(payload.quantity);
    const quantityValue =
      Number.isFinite(incomingQuantity) && incomingQuantity > 0
        ? incomingQuantity
        : 1;
    const reservationResult = await addCartItemWithStockCheck(
      appState,
      payload.productId,
      quantityValue,
    );
    if (!reservationResult.ok) {
      publishNotification({
        type: "error",
        title: "Stock issue",
        message: STOCK_ISSUE_NOTIFICATION_MESSAGE,
      });
      return;
    }

    const productName = appState.productsById[payload.productId]?.name || "Item";
    publishNotification({
      type: "success",
      title: "Item added",
      message: `${productName} was added to your cart.`,
    });
  });
}

export { startStockGating };
