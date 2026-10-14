/**
 * Provides auth token and public-user helpers for the mock data service.
 * Role: Owns the mock Bearer token format and the user shape exposed over the API.
 * Not in this file: Route handling or persistence.
 * Key dependencies: None.
 * See also: src/routes/authRoutes.js, src/routes/userRoutes.js.
 */

/**
 * Projects a stored user record into the shape safe to expose over the API.
 *
 * @param {object} userRecord - Full user record from users.json.
 * @returns {object} Public user without credentials.
 */
function buildPublicUser(userRecord) {
  return {
    id: userRecord.id,
    username: userRecord.username,
    email: userRecord.email,
    fullName: userRecord.fullName,
    gender: userRecord.gender,
    role: userRecord.role || "customer",
    address: userRecord.address,
    avatarUrl: userRecord.avatarUrl,
  };
}

/**
 * Builds a mock token embedding the user id for later extraction.
 *
 * @param {object} userRecord - Authenticated user record.
 * @returns {string} Token in the form mock-token.<userId>.<timestamp>.
 */
function buildAuthToken(userRecord) {
  return `mock-token.${userRecord.id}.${Date.now()}`;
}

/**
 * Extracts the user id segment from a Bearer authorization header.
 *
 * @param {string | undefined} authorizationHeader - Raw Authorization header value.
 * @returns {string | null} User id, or null when the header is missing or malformed.
 */
function extractUserIdFromToken(authorizationHeader) {
  if (!authorizationHeader || typeof authorizationHeader !== "string") {
    return null;
  }
  const trimmedHeader = authorizationHeader.trim();
  const tokenValue = trimmedHeader.startsWith("Bearer ")
    ? trimmedHeader.slice("Bearer ".length).trim()
    : trimmedHeader;
  const tokenSegments = tokenValue.split(".");
  if (tokenSegments.length < 2 || tokenSegments[0] !== "mock-token") {
    return null;
  }
  return tokenSegments[1] || null;
}

const { getRevokedAtForUser, isTokenRevoked } = require("./sessionRevocation");

/**
 * Reports whether a stored user record has the admin role.
 *
 * @param {object} userRecord - Full user record from users.json.
 * @returns {boolean} True when the user is an admin.
 */
function isAdminUser(userRecord) {
  return userRecord?.role === "admin";
}

/**
 * Extracts the timestamp segment from a Bearer authorization header.
 *
 * @param {string | undefined} authorizationHeader - Raw Authorization header value.
 * @returns {number | null} Numeric timestamp, or null when the header is missing or malformed.
 */
function extractTokenIssuedAt(authorizationHeader) {
  if (!authorizationHeader || typeof authorizationHeader !== "string") {
    return null;
  }
  const trimmedHeader = authorizationHeader.trim();
  const tokenValue = trimmedHeader.startsWith("Bearer ")
    ? trimmedHeader.slice("Bearer ".length).trim()
    : trimmedHeader;
  const tokenSegments = tokenValue.split(".");
  if (tokenSegments.length < 3 || tokenSegments[0] !== "mock-token") {
    return null;
  }
  const timestampNumber = Number(tokenSegments[2]);
  return Number.isFinite(timestampNumber) ? timestampNumber : null;
}

/**
 * Resolves the user id from an authorization header, verifying that the token is not revoked.
 *
 * @param {string | undefined} authorizationHeader - Raw Authorization header value.
 * @param {Array<{ userId: string, revokedAt: number | string }> | null | undefined} sessionRevocations - Session revocations array.
 * @returns {string | null} User id when valid and unrevoked; null otherwise.
 */
function resolveAuthenticatedUserId(authorizationHeader, sessionRevocations) {
  const userId = extractUserIdFromToken(authorizationHeader);
  if (!userId) {
    return null;
  }
  const tokenIssuedAt = extractTokenIssuedAt(authorizationHeader);
  const revokedAt = getRevokedAtForUser(sessionRevocations, userId);
  if (isTokenRevoked(tokenIssuedAt, revokedAt)) {
    return null;
  }
  return userId;
}

module.exports = {
  buildPublicUser,
  buildAuthToken,
  extractUserIdFromToken,
  extractTokenIssuedAt,
  resolveAuthenticatedUserId,
  isAdminUser,
};
