/**
 * Unit tests for auth helpers including token parsing and revocation checks.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildAuthToken,
  buildPublicUser,
  extractUserIdFromToken,
  extractTokenIssuedAt,
  isAdminUser,
  resolveAuthenticatedUserId,
} = require("./auth");

test("extractTokenIssuedAt parses timestamp from mock-token format", () => {
  const token = "Bearer mock-token.user-123.1728000000000";
  assert.equal(extractTokenIssuedAt(token), 1728000000000);

  const rawToken = "mock-token.user-456.1728000050000";
  assert.equal(extractTokenIssuedAt(rawToken), 1728000050000);

  assert.equal(extractTokenIssuedAt("invalid-token"), null);
  assert.equal(extractTokenIssuedAt(""), null);
  assert.equal(extractTokenIssuedAt(null), null);
});

test("resolveAuthenticatedUserId validates token and checks revocation", () => {
  const user = { id: "user-123" };
  const token = buildAuthToken(user);
  const issuedAt = extractTokenIssuedAt(token);

  // No revocations -> valid
  assert.equal(resolveAuthenticatedUserId(`Bearer ${token}`, []), "user-123");

  // Revocation in the past -> valid
  const pastRevocation = [{ userId: "user-123", revokedAt: issuedAt - 1000 }];
  assert.equal(resolveAuthenticatedUserId(`Bearer ${token}`, pastRevocation), "user-123");

  // Revocation in future or exact time -> invalid (null)
  const futureRevocation = [{ userId: "user-123", revokedAt: issuedAt + 1000 }];
  assert.equal(resolveAuthenticatedUserId(`Bearer ${token}`, futureRevocation), null);

  const exactRevocation = [{ userId: "user-123", revokedAt: issuedAt }];
  assert.equal(resolveAuthenticatedUserId(`Bearer ${token}`, exactRevocation), null);
});

test("buildPublicUser defaults a missing role to customer and omits the password", () => {
  const publicUser = buildPublicUser({
    id: "u-1",
    username: "ada",
    email: "ada@example.com",
    fullName: "Ada Lovelace",
    gender: "female",
    address: null,
    avatarUrl: "",
    password: "secret",
  });

  assert.equal(publicUser.role, "customer");
  assert.equal(publicUser.password, undefined);
  assert.equal(publicUser.username, "ada");
});

test("buildAuthToken starts with the user id segment", () => {
  const token = buildAuthToken({ id: "user-123" });
  assert.equal(token.startsWith("mock-token.user-123."), true);
});

test("extractUserIdFromToken returns null for a malformed header and the id for a bare token", () => {
  assert.equal(extractUserIdFromToken(undefined), null);
  assert.equal(extractUserIdFromToken(12), null);
  assert.equal(extractUserIdFromToken("Bearer not-a-token"), null);
  assert.equal(extractUserIdFromToken("Token mock-token.user-1.1"), null);
  assert.equal(extractUserIdFromToken("mock-token.user-1.99"), "user-1");
});

test("isAdminUser is true only for the admin role", () => {
  assert.equal(isAdminUser({ role: "admin" }), true);
  assert.equal(isAdminUser({ role: "customer" }), false);
  assert.equal(isAdminUser(undefined), false);
});

test("resolveAuthenticatedUserId returns null when the header has no user id", () => {
  assert.equal(resolveAuthenticatedUserId("not-a-token", []), null);
});

test("extractUserIdFromToken returns null when the user segment is empty", () => {
  assert.equal(extractUserIdFromToken("Bearer mock-token..1728000000000"), null);
});

test("extractTokenIssuedAt returns null when the timestamp segment is not a number", () => {
  assert.equal(extractTokenIssuedAt("Bearer mock-token.user-1.not-a-time"), null);
});
