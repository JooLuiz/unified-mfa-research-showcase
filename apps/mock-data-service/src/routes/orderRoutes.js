/**
 * Serves authenticated order read routes for the mock data service.
 * Role: Returns orders for the authenticated user; order creation is handled over event mesh.
 * Not in this file: Order persistence or mesh gateway handlers.
 * Key dependencies: JSON store; src/domain/auth.js.
 * See also: src/event-mesh/orderRequestHandler.js; src/server.js.
 */

const express = require("express");
const { extractUserIdFromToken } = require("../domain/auth");

/**
 * Creates the order router.
 *
 * @param {{ readJsonFileWithDefault: (fileName: string, defaultValue: unknown) => Promise<unknown> }} jsonStore - JSON file store bound to the data directory.
 * @returns {import("express").Router} Router with order read endpoints.
 */
function createOrderRouter(jsonStore) {
  const router = express.Router();

  router.get("/orders", async (request, response) => {
    try {
      const userIdFromToken = extractUserIdFromToken(request.headers.authorization);
      if (!userIdFromToken) {
        response.status(401).json({ message: "Missing or invalid token" });
        return;
      }

      const ordersData = await jsonStore.readJsonFileWithDefault("orders.json", []);
      const userOrders = ordersData.filter((order) => order.userId === userIdFromToken);
      response.json({
        total: userOrders.length,
        items: userOrders,
      });
    } catch (error) {
      response.status(500).json({
        message: "Unable to load orders",
        details: error.message,
      });
    }
  });

  router.get("/orders/:orderId", async (request, response) => {
    try {
      const userIdFromToken = extractUserIdFromToken(request.headers.authorization);
      if (!userIdFromToken) {
        response.status(401).json({ message: "Missing or invalid token" });
        return;
      }

      const ordersData = await jsonStore.readJsonFileWithDefault("orders.json", []);
      const matchingOrder = ordersData.find(
        (order) => order.id === request.params.orderId,
      );

      if (!matchingOrder) {
        response.status(404).json({ message: "Order not found" });
        return;
      }

      if (matchingOrder.userId !== userIdFromToken) {
        response.status(403).json({ message: "Not allowed to access this order" });
        return;
      }

      response.json(matchingOrder);
    } catch (error) {
      response.status(500).json({
        message: "Unable to load order",
        details: error.message,
      });
    }
  });

  return router;
}

module.exports = { createOrderRouter };
