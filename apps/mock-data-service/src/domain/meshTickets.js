/**
 * Issues and validates one-time mesh connection tickets for the mock data service.
 * Role: Owns short-lived credentials consumed during WebSocket upgrade authentication.
 * Not in this file: HTTP routing or gateway configuration.
 * Key dependencies: src/domain/identifiers.js.
 * See also: src/routes/authRoutes.js; src/event-mesh/gatewayAuth.js.
 */

const { randomBytes } = require("crypto");
const { generateIdentifier } = require("./identifiers");

const MESH_TICKET_TTL_MS = 30_000;

/** @type {Map<string, { userId: string, roles: string[], expiresAt: number }>} */
const meshTicketsByValue = new Map();

/**
 * Maps a stored user role to the gateway credential roles array.
 *
 * @param {string | undefined} userRole - Role from users.json.
 * @returns {string[]} Gateway roles for the authenticated connection.
 */
function buildMeshRolesFromUserRole(userRole) {
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
function purgeExpiredMeshTickets() {
  const now = Date.now();
  for (const [ticketValue, ticketRecord] of meshTicketsByValue.entries()) {
    if (ticketRecord.expiresAt <= now) {
      meshTicketsByValue.delete(ticketValue);
    }
  }
}

/**
 * Issues a one-time mesh connection ticket for an authenticated user.
 *
 * @param {{ userId: string, roles: string[] }} ticketInput - User identity and gateway roles.
 * @returns {string} Opaque ticket value for WebSocket upgrade.
 * @sideEffects Stores the ticket until consumed or expired.
 */
function issueMeshTicket({ userId, roles }) {
  purgeExpiredMeshTickets();

  const ticketValue = `mesh-${generateIdentifier("ticket")}-${randomBytes(16).toString("hex")}`;
  meshTicketsByValue.set(ticketValue, {
    userId,
    roles,
    expiresAt: Date.now() + MESH_TICKET_TTL_MS,
  });

  return ticketValue;
}

/**
 * Validates and consumes a mesh ticket, returning the gateway credential.
 *
 * @param {string | null | undefined} ticketValue - Ticket from the WebSocket upgrade URL.
 * @returns {{ userId: string, roles: string[] } | null} Credential object, or null when invalid.
 * @sideEffects Deletes the ticket on successful consumption.
 */
function consumeMeshTicket(ticketValue) {
  if (!ticketValue || typeof ticketValue !== "string") {
    return null;
  }

  purgeExpiredMeshTickets();

  const ticketRecord = meshTicketsByValue.get(ticketValue);
  if (!ticketRecord) {
    return null;
  }

  meshTicketsByValue.delete(ticketValue);

  if (ticketRecord.expiresAt <= Date.now()) {
    return null;
  }

  return {
    userId: ticketRecord.userId,
    roles: ticketRecord.roles,
  };
}

module.exports = {
  MESH_TICKET_TTL_MS,
  buildMeshRolesFromUserRole,
  issueMeshTicket,
  consumeMeshTicket,
};
