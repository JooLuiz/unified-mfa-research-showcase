/**
 * Serves order status writes and the per-tab order-status streams.
 * Role: Handles PUT /orders/:orderId/status, the customer and admin connection tickets, and
 *   GET /orders/stream plus GET /admin/orders/stream, mounted at /api.
 * Not in this file: Transition rules (src/domain/orderStatus.js) or the response registry
 *   (src/infrastructure/orderEventStream.js).
 * Key dependencies: orders.json via the JSON store; src/domain/auth.js; src/domain/connectionTickets.js;
 *   src/infrastructure/stockEventStream.js for the cancel broadcast.
 * See also: src/server.js; src/routes/orderRoutes.js; src/routes/adminRoutes.js.
 */

const express = require("express");
const { resolveAuthenticatedUserId, isAdminUser } = require("../domain/auth");
const {
  buildConnectionRolesFromUserRole,
  consumeConnectionTicket,
  issueConnectionTicket,
} = require("../domain/connectionTickets");
const {
  ORDER_STATUS_INVALID_TRANSITION_CODE,
  ORDER_STATUS_NOT_ALLOWED_CODE,
  applyOrderStatusChange,
} = require("../domain/orderStatus");

const ORDER_STATUS_SSE_HEARTBEAT_INTERVAL_MS = 20_000;

/**
 * Reads users.json and returns the user that matches the bearer token.
 *
 * @param {import("express").Request} request - Incoming request with an Authorization header.
 * @param {{ readJsonFile: (fileName: string) => Promise<Array<{ id: string, role?: string }>> }} jsonStore - JSON file store.
 * @returns {Promise<object | { status: number, message: string }>} Matching user, or an HTTP error body.
 */
async function resolveAuthenticatedUser(request, jsonStore) {
  const sessionRevocations = await jsonStore.readJsonFileWithDefault("sessionRevocations.json", []);
  const userIdFromToken = resolveAuthenticatedUserId(request.headers.authorization, sessionRevocations);
  if (!userIdFromToken) {
    return { status: 401, message: "Missing or invalid token" };
  }
  const usersData = await jsonStore.readJsonFile("users.json");
  const matchingUser = usersData.find((userRecord) => userRecord.id === userIdFromToken);
  if (!matchingUser) {
    return { status: 404, message: "User not found" };
  }
  return matchingUser;
}

/**
 * Opens an SSE response and keeps it alive until the client disconnects.
 *
 * @param {import("express").Response} response - Response that will carry the stream.
 * @param {(response: import("express").Response) => void} registerResponse - Registry callback for this connection.
 * @returns {void}
 * @sideEffects Flushes SSE headers and writes a heartbeat until close.
 */
function openStatusStream(response, registerResponse) {
  response.setHeader("Content-Type", "text/event-stream");
  response.setHeader("Cache-Control", "no-cache");
  response.setHeader("Connection", "keep-alive");
  response.flushHeaders();
  registerResponse(response);

  const heartbeatIntervalId = setInterval(() => {
    response.write(": ping\n\n");
  }, ORDER_STATUS_SSE_HEARTBEAT_INTERVAL_MS);
  response.on("close", () => {
    clearInterval(heartbeatIntervalId);
  });
}

/**
 * Creates the order-status router.
 *
 * @param {{ readJsonFile: (fileName: string) => Promise<any>, readJsonFileWithDefault: (fileName: string, defaultValue: any) => Promise<any>, writeJsonFile: (fileName: string, data: any) => Promise<void> }} jsonStore - JSON file store bound to the data directory.
 * @param {{ registerCustomer: (userId: string, response: import("express").Response) => void, registerAdmin: (response: import("express").Response) => void, broadcastStatusChanged: (userId: string, orderId: string, status: string) => void }} orderEventStream - SSE registry for customer and admin tabs.
 * @param {{ broadcastStockChanged: (productId: string, available: number) => void }} stockEventStream - Notifies stock watchers after a cancellation restores stock.
 * @returns {import("express").Router} Router with the status write and the two streams.
 */
function createOrderStatusRouter(jsonStore, orderEventStream, stockEventStream) {
  const router = express.Router();

  /**
   * PUT /orders/:orderId/status. Auth: Bearer token. Body: { status }.
   * A customer may set cancellation-requested on their own order. An admin may set every
   * other allowed status on any order. 404 when the order is missing or is not the
   * customer's. 403 when the actor cannot make that transition. 409 when the transition
   * itself is illegal.
   */
  router.put("/orders/:orderId/status", async (request, response) => {
    try {
      const authenticatedUser = await resolveAuthenticatedUser(request, jsonStore);
      if (authenticatedUser.status) {
        response.status(authenticatedUser.status).json({ message: authenticatedUser.message });
        return;
      }

      const ordersData = await jsonStore.readJsonFileWithDefault("orders.json", []);
      const orderIndex = ordersData.findIndex((order) => order.id === request.params.orderId);
      if (orderIndex < 0) {
        response.status(404).json({ message: "Order not found" });
        return;
      }

      const currentOrder = ordersData[orderIndex];
      const actorIsAdmin = isAdminUser(authenticatedUser);
      if (!actorIsAdmin && currentOrder.userId !== authenticatedUser.id) {
        response.status(404).json({ message: "Order not found" });
        return;
      }

      const changeResult = await applyOrderStatusChange({
        jsonStore,
        order: currentOrder,
        nextStatus: request.body?.status,
        actor: actorIsAdmin ? "admin" : "customer",
      });
      if (!changeResult.ok) {
        if (changeResult.code === ORDER_STATUS_NOT_ALLOWED_CODE) {
          response.status(403).json({
            message: "Not allowed to set this status",
            code: changeResult.code,
          });
          return;
        }
        if (changeResult.code === ORDER_STATUS_INVALID_TRANSITION_CODE) {
          response.status(409).json({
            message: "That status change is not allowed",
            code: changeResult.code,
          });
          return;
        }
        response.status(500).json({
          message: "Unable to update order status",
          code: changeResult.code,
        });
        return;
      }

      ordersData[orderIndex] = changeResult.order;
      await jsonStore.writeJsonFile("orders.json", ordersData);
      orderEventStream.broadcastStatusChanged(
        changeResult.order.userId,
        changeResult.order.id,
        changeResult.order.status,
      );
      changeResult.stockAvailability.forEach(({ productId, available }) => {
        stockEventStream.broadcastStockChanged(productId, available);
      });
      response.json(changeResult.order);
    } catch (error) {
      response.status(500).json({
        message: "Unable to update order status",
        details: error.message,
      });
    }
  });

  /**
   * POST /orders/connection-tickets. Auth: any Bearer token. Output: a one-time ticket for
   * GET /orders/stream, because EventSource cannot send an Authorization header.
   */
  router.post("/orders/connection-tickets", async (request, response) => {
    try {
      const authenticatedUser = await resolveAuthenticatedUser(request, jsonStore);
      if (authenticatedUser.status) {
        response.status(authenticatedUser.status).json({ message: authenticatedUser.message });
        return;
      }
      const ticket = issueConnectionTicket({
        userId: authenticatedUser.id,
        roles: buildConnectionRolesFromUserRole(authenticatedUser.role),
      });
      response.json({ ticket });
    } catch (error) {
      response.status(500).json({
        message: "Unable to issue connection ticket",
        details: error.message,
      });
    }
  });

  /**
   * GET /orders/stream. Auth: one-time ticket from POST /orders/connection-tickets.
   * Output: a Server-Sent Events stream of orders.status-changed for that ticket's user only.
   */
  router.get("/orders/stream", (request, response) => {
    const credential = consumeConnectionTicket(request.query.ticket);
    if (!credential?.userId) {
      response.status(401).json({ message: "Invalid or expired connection ticket" });
      return;
    }
    openStatusStream(response, (streamResponse) => {
      orderEventStream.registerCustomer(credential.userId, streamResponse);
    });
  });

  /**
   * POST /admin/orders/connection-tickets. Auth: Bearer token with admin role.
   * Output: a one-time ticket for GET /admin/orders/stream.
   */
  router.post("/admin/orders/connection-tickets", async (request, response) => {
    try {
      const authenticatedUser = await resolveAuthenticatedUser(request, jsonStore);
      if (authenticatedUser.status) {
        response.status(authenticatedUser.status).json({ message: authenticatedUser.message });
        return;
      }
      if (!isAdminUser(authenticatedUser)) {
        response.status(403).json({ message: "Admin access required" });
        return;
      }
      const ticket = issueConnectionTicket({
        userId: authenticatedUser.id,
        roles: buildConnectionRolesFromUserRole(authenticatedUser.role),
      });
      response.json({ ticket });
    } catch (error) {
      response.status(500).json({
        message: "Unable to issue connection ticket",
        details: error.message,
      });
    }
  });

  /**
   * GET /admin/orders/stream. Auth: one-time admin ticket from POST
   * /admin/orders/connection-tickets. Output: a Server-Sent Events stream of
   * orders.status-changed for every order.
   */
  router.get("/admin/orders/stream", (request, response) => {
    const credential = consumeConnectionTicket(request.query.ticket);
    if (!credential || !credential.roles.includes("admin")) {
      response.status(401).json({ message: "Invalid or expired connection ticket" });
      return;
    }
    openStatusStream(response, (streamResponse) => {
      orderEventStream.registerAdmin(streamResponse);
    });
  });

  return router;
}

module.exports = { createOrderStatusRouter };
