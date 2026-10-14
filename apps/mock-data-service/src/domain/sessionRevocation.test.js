/**
 * Unit tests for session revocation pure domain logic.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  getRevokedAtForUser,
  revokeAllSessionsForUser,
  isTokenRevoked,
} = require("./sessionRevocation");

test("getRevokedAtForUser returns null when no revocations list or user not present", () => {
  assert.equal(getRevokedAtForUser(null, "u-01"), null);
  assert.equal(getRevokedAtForUser([], "u-01"), null);
  assert.equal(getRevokedAtForUser([{ userId: "u-02", revokedAt: 1000 }], "u-01"), null);
});

test("getRevokedAtForUser returns numeric revokedAt when user is present", () => {
  const revocations = [
    { userId: "u-01", revokedAt: 1728000000000 },
    { userId: "u-02", revokedAt: 1728000050000 },
  ];
  assert.equal(getRevokedAtForUser(revocations, "u-01"), 1728000000000);
});

test("revokeAllSessionsForUser appends new record or updates existing one", () => {
  const initial = [{ userId: "u-01", revokedAt: 1000 }];
  const added = revokeAllSessionsForUser(initial, "u-02", 2000);
  assert.equal(added.length, 2);
  assert.deepEqual(added.find((item) => item.userId === "u-02"), { userId: "u-02", revokedAt: 2000 });

  const updated = revokeAllSessionsForUser(added, "u-01", 3000);
  assert.equal(updated.length, 2);
  assert.deepEqual(updated.find((item) => item.userId === "u-01"), { userId: "u-01", revokedAt: 3000 });
});

test("isTokenRevoked compares tokenIssuedAt strictly against revokedAt", () => {
  assert.equal(isTokenRevoked(2000, null), false);
  assert.equal(isTokenRevoked(2000, undefined), false);

  // If tokenIssuedAt <= revokedAt, it is revoked (true)
  assert.equal(isTokenRevoked(1000, 1000), true);
  assert.equal(isTokenRevoked(999, 1000), true);
  assert.equal(isTokenRevoked(null, 1000), true);

  // If tokenIssuedAt > revokedAt, it is valid (not revoked => false)
  assert.equal(isTokenRevoked(1001, 1000), false);
});
