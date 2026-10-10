/**
 * Persists guest stock holds for the mock data service.
 * Role: Reads, writes, and removes per-session hold lines in guestHolds.json.
 * Not in this file: Availability math or holder resolution (src/domain/stock.js) or HTTP routing
 *   (src/routes/stockRoutes.js).
 * Key dependencies: JSON store.
 * See also: src/domain/stock.js.
 */

const GUEST_HOLDS_FILE_NAME = "guestHolds.json";
const GUEST_HOLDS_PERSISTENCE_FAILED_CODE = "guest-holds-persistence-failed";

/**
 * Reads the stored guest holds, rejecting a file that is not a plain object.
 *
 * @param {{ readJsonFileWithDefault: (fileName: string, defaultValue: unknown) => Promise<unknown> }} jsonStore - JSON file store bound to the data directory.
 * @returns {Promise<{ ok: true, guestHolds: Record<string, Array<{ productId: string, quantity: number }>> } | { ok: false, code: string }>} Stored guest holds, keyed by session id.
 */
async function readGuestHoldsData(jsonStore) {
  try {
    const guestHoldsData = await jsonStore.readJsonFileWithDefault(GUEST_HOLDS_FILE_NAME, {});
    if (!guestHoldsData || typeof guestHoldsData !== "object" || Array.isArray(guestHoldsData)) {
      return { ok: false, code: GUEST_HOLDS_PERSISTENCE_FAILED_CODE };
    }
    return { ok: true, guestHolds: guestHoldsData };
  } catch (error) {
    console.error("readGuestHoldsData - error");
    console.error(error);
    return { ok: false, code: GUEST_HOLDS_PERSISTENCE_FAILED_CODE };
  }
}

/**
 * Returns one guest session's hold lines, defaulting to an empty array.
 *
 * @param {Record<string, Array<{ productId: string, quantity: number }>>} guestHoldsData - Stored guest holds.
 * @param {string} sessionId - Guest browser session id.
 * @returns {Array<{ productId: string, quantity: number }>} That session's lines.
 */
function getGuestHoldLines(guestHoldsData, sessionId) {
  const lines = guestHoldsData[sessionId];
  return Array.isArray(lines) ? lines : [];
}

/**
 * Returns the quantity one guest session holds for one product.
 *
 * @param {Record<string, Array<{ productId: string, quantity: number }>>} guestHoldsData - Stored guest holds.
 * @param {string} sessionId - Guest browser session id.
 * @param {string} productId - Catalog product id.
 * @returns {number} Held quantity, or 0 when the session holds none.
 */
function getGuestHoldQuantity(guestHoldsData, sessionId, productId) {
  const matchingLine = getGuestHoldLines(guestHoldsData, sessionId).find(
    (line) => line.productId === productId,
  );
  return matchingLine ? matchingLine.quantity : 0;
}

/**
 * Sums every guest session's held quantity for one product.
 *
 * @param {Record<string, Array<{ productId: string, quantity: number }>>} guestHoldsData - Stored guest holds.
 * @param {string} productId - Catalog product id.
 * @returns {number} Total quantity guests hold for that product.
 */
function getTotalGuestHoldQuantity(guestHoldsData, productId) {
  return Object.keys(guestHoldsData).reduce(
    (total, sessionId) => total + getGuestHoldQuantity(guestHoldsData, sessionId, productId),
    0,
  );
}

/**
 * Writes one guest session's line for one product, removing the line at quantity 0.
 *
 * @param {{ jsonStore: object, sessionId: string, productId: string, quantity: number }} holdInput - Store, session, product, and the next absolute quantity.
 * @returns {Promise<{ ok: true } | { ok: false, code: string }>} Whether the write succeeded.
 * @sideEffects Writes guestHolds.json.
 */
async function writeGuestHoldLine({ jsonStore, sessionId, productId, quantity }) {
  const guestHoldsResult = await readGuestHoldsData(jsonStore);
  if (!guestHoldsResult.ok) {
    return guestHoldsResult;
  }

  const remainingLines = getGuestHoldLines(guestHoldsResult.guestHolds, sessionId).filter(
    (line) => line.productId !== productId,
  );
  const nextLines = quantity > 0 ? [...remainingLines, { productId, quantity }] : remainingLines;

  const nextGuestHolds = { ...guestHoldsResult.guestHolds };
  if (nextLines.length > 0) {
    nextGuestHolds[sessionId] = nextLines;
  } else {
    delete nextGuestHolds[sessionId];
  }

  try {
    await jsonStore.writeJsonFile(GUEST_HOLDS_FILE_NAME, nextGuestHolds);
    return { ok: true };
  } catch (error) {
    console.error("writeGuestHoldLine - error");
    console.error(error);
    return { ok: false, code: GUEST_HOLDS_PERSISTENCE_FAILED_CODE };
  }
}

/**
 * Deletes every hold line for one guest session.
 *
 * @param {{ jsonStore: object, sessionId: string }} sessionInput - Store and the session to release.
 * @returns {Promise<{ ok: true, removedLines: Array<{ productId: string, quantity: number }> } | { ok: false, code: string }>} The lines that were removed, for the caller to recompute availability.
 * @sideEffects Writes guestHolds.json when that session held any lines.
 */
async function deleteGuestHoldSession({ jsonStore, sessionId }) {
  const guestHoldsResult = await readGuestHoldsData(jsonStore);
  if (!guestHoldsResult.ok) {
    return guestHoldsResult;
  }

  const removedLines = getGuestHoldLines(guestHoldsResult.guestHolds, sessionId);
  if (removedLines.length === 0) {
    return { ok: true, removedLines };
  }

  const nextGuestHolds = { ...guestHoldsResult.guestHolds };
  delete nextGuestHolds[sessionId];

  try {
    await jsonStore.writeJsonFile(GUEST_HOLDS_FILE_NAME, nextGuestHolds);
    return { ok: true, removedLines };
  } catch (error) {
    console.error("deleteGuestHoldSession - error");
    console.error(error);
    return { ok: false, code: GUEST_HOLDS_PERSISTENCE_FAILED_CODE };
  }
}

module.exports = {
  GUEST_HOLDS_PERSISTENCE_FAILED_CODE,
  readGuestHoldsData,
  getGuestHoldLines,
  getGuestHoldQuantity,
  getTotalGuestHoldQuantity,
  writeGuestHoldLine,
  deleteGuestHoldSession,
};
