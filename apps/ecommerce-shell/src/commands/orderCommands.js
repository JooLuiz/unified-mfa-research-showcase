/**
 * Persists checkout orders for the ecommerce shell.
 * Role: Owns the order HTTP command so checkout UI code only handles the { ok } outcome.
 * Not in this file: Cart state, toast copy, or post-order navigation (src/pages/checkoutPage.js).
 * Key dependencies: Mock data service POST /api/orders.
 * See also: src/pages/checkoutPage.js.
 */

import { MOCK_API_BASE_URL } from "../utils/constants";
import fetchJson from "../utils/fetchJson";

/**
 * Persists an order before checkout clears local cart state.
 *
 * @param {object} appState - Shell state containing the authenticated session.
 * @param {object} orderPayload - Order values accepted by the order endpoint.
 * @returns {Promise<{ ok: boolean }>} Whether the server accepted the order.
 * @sideEffects Performs the HTTP order command.
 */
async function persistOrder(appState, orderPayload) {
  if (!appState.authToken) {
    return { ok: false };
  }
  try {
    await fetchJson(`${MOCK_API_BASE_URL}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${appState.authToken}`,
      },
      body: JSON.stringify(orderPayload),
    });
    return { ok: true };
  } catch (error) {
    console.warn("persistOrder - error");
    console.warn(error);
    return { ok: false };
  }
}

export { persistOrder };
