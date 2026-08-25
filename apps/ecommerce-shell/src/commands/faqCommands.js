/**
 * Persists FAQ form submissions for the ecommerce shell.
 * Role: Owns the FAQ HTTP command so page modules stay free of request details.
 * Not in this file: FAQ iframe rendering or message handling (src/pages/homePage.js), notifications.
 * Key dependencies: Mock data service POST /api/faq.
 * See also: src/pages/homePage.js.
 */

import { MOCK_API_BASE_URL } from "../utils/constants";
import fetchJson from "../utils/fetchJson";

/**
 * Persists a FAQ answer, optionally with the authenticated user's token.
 *
 * @param {object} appState - Shell state containing the optional auth token.
 * @param {object} faqPayload - FAQ fields accepted by the FAQ endpoint.
 * @returns {Promise<void>}
 * @sideEffects Performs the HTTP FAQ command.
 */
async function persistFaqAnswerToApi(appState, faqPayload) {
  try {
    await fetchJson(`${MOCK_API_BASE_URL}/faq`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(appState.authToken
          ? { Authorization: `Bearer ${appState.authToken}` }
          : {}),
      },
      body: JSON.stringify(faqPayload),
    });
  } catch (error) {
    console.warn("persistFaqAnswerToApi - error");
    console.warn(error);
  }
}

export { persistFaqAnswerToApi };
