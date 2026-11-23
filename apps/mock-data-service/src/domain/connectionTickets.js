/**
 * Issues and validates one-time connection tickets for the mock data service.
 * Role: Owns short-lived credentials consumed when a client can't send an Authorization
 *   header on the connecting request (SSE and WebSocket upgrades both qualify).
 * Not in this file: HTTP routing or gateway configuration.
 * Key dependencies: src/domain/identifiers.js.
 * See also: On `main`, src/routes/adminRoutes.js issues tickets via POST
 *   /admin/connection-tickets and consumes them in GET /admin/events to authenticate the
 *   admin live-notifications SSE stream. On the mesh branch,
 *   src/inbound/gatewayAuth.js consumes these same tickets during WebSocket upgrade.
 */

const { randomBytes } = require("crypto");
const { generateIdentifier } = require("./identifiers");

const CONNECTION_TICKET_TTL_MS = 30_000;

/** @type {Map<string, { userId: string, roles: string[], expiresAt: number, tokenIssuedAt?: number }>} */
const connectionTicketsByValue = new Map();

/**
 * Maps a stored user role to the gateway credential roles array.
 *
 * @param {string | undefined} userRole - Role from users.json.
 * @returns {string[]} Gateway roles for the authenticated connection.
 */
function buildConnectionRolesFromUserRole(userRole) {
  if (userRole === "admin") {
    return ["admin"];
  }
  return ["customer"];
}

/**
 * Removes expired tickets from the in-memory store.
 *
 * @returns {void}
 * @sideEffects Deletes stale ticket entries.
 */
function purgeExpiredConnectionTickets() {
  const now = Date.now();
  for (const [ticketValue, ticketRecord] of connectionTicketsByValue.entries()) {
    if (ticketRecord.expiresAt <= now) {
      connectionTicketsByValue.delete(ticketValue);
    }
  }
}

/**
 * Issues a one-time connection ticket for an authenticated user.
 *
 * @param {{ userId: string, roles: string[], tokenIssuedAt?: number }} ticketInput - User identity, gateway roles, and the Bearer token's issued-at when known.
 * @returns {string} Opaque ticket value for WebSocket upgrade.
 * @sideEffects Stores the ticket until consumed or expired.
 */
function issueConnectionTicket({ userId, roles, tokenIssuedAt }) {
  purgeExpiredConnectionTickets();

  const ticketValue = `connection-${generateIdentifier("ticket")}-${randomBytes(16).toString("hex")}`;
  /** @type {{ userId: string, roles: string[], expiresAt: number, tokenIssuedAt?: number }} */
  const ticketRecord = {
    userId,
    roles,
    expiresAt: Date.now() + CONNECTION_TICKET_TTL_MS,
  };
  if (Number.isFinite(tokenIssuedAt)) {
    ticketRecord.tokenIssuedAt = tokenIssuedAt;
  }
  connectionTicketsByValue.set(ticketValue, ticketRecord);

  return ticketValue;
}

/**
 * Validates and consumes a connection ticket, returning the gateway credential.
 *
 * @param {string | null | undefined} ticketValue - Ticket from the WebSocket upgrade URL.
 * @returns {{ userId: string, roles: string[], tokenIssuedAt?: number } | null} Credential object, or null when invalid. tokenIssuedAt is present only when the ticket was stamped with a finite issued-at.
 * @sideEffects Deletes the ticket on successful consumption.
 */
function consumeConnectionTicket(ticketValue) {
  if (!ticketValue || typeof ticketValue !== "string") {
    return null;
  }

  purgeExpiredConnectionTickets();

  const ticketRecord = connectionTicketsByValue.get(ticketValue);
  if (!ticketRecord) {
    return null;
  }

  connectionTicketsByValue.delete(ticketValue);

  if (ticketRecord.expiresAt <= Date.now()) {
    return null;
  }

  /** @type {{ userId: string, roles: string[], tokenIssuedAt?: number }} */
  const credential = {
    userId: ticketRecord.userId,
    roles: ticketRecord.roles,
  };
  if (Number.isFinite(ticketRecord.tokenIssuedAt)) {
    credential.tokenIssuedAt = ticketRecord.tokenIssuedAt;
  }
  return credential;
}

module.exports = {
  CONNECTION_TICKET_TTL_MS,
  buildConnectionRolesFromUserRole,
  issueConnectionTicket,
  consumeConnectionTicket,
};
