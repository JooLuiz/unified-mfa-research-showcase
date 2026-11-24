/**
 * Persists FAQ form submissions for the ecommerce shell.
 * Role: Owns the FAQ submit command so page modules stay free of request details.
 * Not in this file: FAQ iframe rendering or message handling (src/pages/homePage.js), notifications.
 * Key dependencies: An injected shell transport (faq:submit).
 * See also: src/pages/homePage.js.
 */

const FAQ_TOPIC = "faq";
const FAQ_SUBMIT_EVENT = "submit";

/**
 * Persists a FAQ answer, optionally with the authenticated user's token.
 *
 * @param {{ request: (message: { topic: string, event: string, payload?: object }) => Promise<{ ok: boolean }> }} transport - Shell transport that runs the FAQ submit request.
 * @param {object} appState - Shell state containing the optional auth token.
 * @param {object} faqPayload - FAQ fields accepted by the FAQ submit request.
 * @returns {Promise<{ ok: boolean }>} Whether the server accepted the answer.
 * @sideEffects Requests faq:submit and logs a warning when it fails.
 */
async function persistFaqAnswerToApi(transport, appState, faqPayload) {
  const outcome = await transport.request({
    topic: FAQ_TOPIC,
    event: FAQ_SUBMIT_EVENT,
    payload: { authToken: appState.authToken || "", answer: faqPayload },
  });
  if (!outcome.ok) {
    console.warn("persistFaqAnswerToApi - request failed");
    return { ok: false };
  }
  return { ok: true };
}

export { persistFaqAnswerToApi };
