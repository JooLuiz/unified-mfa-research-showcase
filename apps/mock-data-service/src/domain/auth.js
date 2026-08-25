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

/**
 * Reports whether a stored user record has the admin role.
 *
 * @param {object} userRecord - Full user record from users.json.
 * @returns {boolean} True when the user is an admin.
 */
function isAdminUser(userRecord) {
  return userRecord?.role === "admin";
}

module.exports = { buildPublicUser, buildAuthToken, extractUserIdFromToken, isAdminUser };
