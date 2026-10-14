/**
 * Manages user session revocations for the mock data service.
 * Role: Provides pure functions to query, update, and evaluate user session revocation timestamps.
 * Not in this file: File system I/O or route handling.
 * Key dependencies: None.
 * See also: src/domain/auth.js, src/routes/sessionRoutes.js.
 */

/**
 * Returns the recorded revocation timestamp for a user, or null if none exists.
 *
 * @param {Array<{ userId: string, revokedAt: number | string }> | null | undefined} sessionRevocations - Stored revocations array.
 * @param {string} userId - Target user identifier.
 * @returns {number | null} Numeric revocation timestamp in milliseconds, or null.
 */
function getRevokedAtForUser(sessionRevocations, userId) {
  if (!Array.isArray(sessionRevocations) || !userId) {
    return null;
  }
  const matchingRecord = sessionRevocations.find((record) => record.userId === userId);
  if (!matchingRecord || matchingRecord.revokedAt === undefined || matchingRecord.revokedAt === null) {
    return null;
  }
  const parsedTimestamp = Number(matchingRecord.revokedAt);
  return Number.isFinite(parsedTimestamp) ? parsedTimestamp : null;
}

/**
 * Updates or adds a revocation timestamp record for a user.
 *
 * @param {Array<{ userId: string, revokedAt: number | string }> | null | undefined} sessionRevocations - Existing revocations array.
 * @param {string} userId - Target user identifier.
 * @param {number} revokedAt - Numeric revocation timestamp in milliseconds.
 * @returns {Array<{ userId: string, revokedAt: number }>} Updated revocations array with the user's record set.
 */
function revokeAllSessionsForUser(sessionRevocations, userId, revokedAt) {
  const currentList = Array.isArray(sessionRevocations) ? [...sessionRevocations] : [];
  const existingIndex = currentList.findIndex((record) => record.userId === userId);
  const updatedRecord = { userId, revokedAt: Number(revokedAt) };

  if (existingIndex >= 0) {
    currentList[existingIndex] = updatedRecord;
  } else {
    currentList.push(updatedRecord);
  }

  return currentList;
}

/**
 * Checks whether a token's issued timestamp has been revoked by a user's revocation watermark.
 * A token is valid only when its embedded timestamp is strictly after that user's revokedAt.
 *
 * @param {number | null | undefined} tokenIssuedAt - Numeric timestamp embedded in the token.
 * @param {number | null | undefined} revokedAt - Numeric revocation watermark for the user.
 * @returns {boolean} True if the token was issued on or before the revocation timestamp.
 */
function isTokenRevoked(tokenIssuedAt, revokedAt) {
  if (revokedAt === null || revokedAt === undefined) {
    return false;
  }
  if (!tokenIssuedAt || !Number.isFinite(tokenIssuedAt)) {
    return true;
  }
  return tokenIssuedAt <= revokedAt;
}

module.exports = {
  getRevokedAtForUser,
  revokeAllSessionsForUser,
  isTokenRevoked,
};
