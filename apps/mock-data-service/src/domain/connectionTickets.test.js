/**
 * Verifies one-time connection tickets and the role mapping those tickets carry.
 * Role: Exercises issue, consume, expiry, and role mapping without HTTP or the gateway.
 * Not in this file: Route handlers or WebSocket upgrade.
 * Key dependencies: node:test; src/domain/connectionTickets.js.
 * See also: src/domain/connectionTickets.js.
 */

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  CONNECTION_TICKET_TTL_MS,
  buildConnectionRolesFromUserRole,
  consumeConnectionTicket,
  issueConnectionTicket,
} = require("./connectionTickets");

test("buildConnectionRolesFromUserRole maps admin and every other role", () => {
  assert.deepEqual(buildConnectionRolesFromUserRole("admin"), ["admin"]);
  assert.deepEqual(buildConnectionRolesFromUserRole("customer"), ["customer"]);
  assert.deepEqual(buildConnectionRolesFromUserRole(undefined), ["customer"]);
});

test("consumeConnectionTicket returns the credential once and rejects unknown values", () => {
  const ticketValue = issueConnectionTicket({
    userId: "u-01",
    roles: buildConnectionRolesFromUserRole("admin"),
  });

  assert.deepEqual(consumeConnectionTicket(ticketValue), {
    userId: "u-01",
    roles: ["admin"],
  });
  assert.equal(consumeConnectionTicket(ticketValue), null);
  assert.equal(consumeConnectionTicket(null), null);
  assert.equal(consumeConnectionTicket(""), null);
  assert.equal(consumeConnectionTicket("not-a-ticket"), null);
});

test("consumeConnectionTicket rejects a ticket after its TTL", (testContext) => {
  testContext.mock.timers.enable({ apis: ["Date"] });
  const ticketValue = issueConnectionTicket({ userId: "u-01", roles: ["customer"] });
  testContext.mock.timers.tick(CONNECTION_TICKET_TTL_MS);

  assert.equal(consumeConnectionTicket(ticketValue), null);
});
