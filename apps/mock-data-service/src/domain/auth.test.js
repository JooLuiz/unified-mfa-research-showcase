/**
 * Unit tests for auth helpers including token parsing and revocation checks.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildAuthToken,
  extractUserIdFromToken,
  extractTokenIssuedAt,
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
