/**
 * Serves order routes for the mock data service.
 * Role: Handles POST /orders, GET /orders, and GET /orders/:orderId, mounted at /api.
 * Not in this file: Token helpers (src/domain/auth.js) or id generation (src/domain/identifiers.js).
 * Key dependencies: orders.json and users.json via the JSON store.
 * See also: src/server.js.
 */

const express = require("express");
const { extractUserIdFromToken } = require("../domain/auth");
const { generateIdentifier } = require("../domain/identifiers");

/**
 * Creates the order router.
 *
 * @param {{ readJsonFile: (fileName: string) => Promise<any>, readJsonFileWithDefault: (fileName: string, defaultValue: any) => Promise<any>, writeJsonFile: (fileName: string, data: any) => Promise<void> }} jsonStore - JSON file store bound to the data directory.
 * @returns {import("express").Router} Router with the /orders routes.
 */
function createOrderRouter(jsonStore) {
  const router = express.Router();

  router.post("/orders", async (request, response) => {
    try {
      const userIdFromToken = extractUserIdFromToken(request.headers.authorization);
      if (!userIdFromToken) {
        response.status(401).json({ message: "Missing or invalid token" });
        return;
      }

      const usersData = await jsonStore.readJsonFile("users.json");
      const matchingUser = usersData.find(
        (userRecord) => userRecord.id === userIdFromToken,
      );
      if (!matchingUser) {
        response.status(404).json({ message: "User not found" });
        return;
      }

      const orderPayload = request.body || {};
      const orderItems = Array.isArray(orderPayload.items) ? orderPayload.items : [];
      if (orderItems.length === 0) {
        response.status(400).json({ message: "An order must include at least one item" });
        return;
      }

      const newOrder = {
        id: generateIdentifier("order"),
        userId: matchingUser.id,
        items: orderItems,
        subtotal: Number(orderPayload.subtotal) || 0,
        discountAmount: Number(orderPayload.discountAmount) || 0,
        totalAmount: Number(orderPayload.totalAmount) || 0,
        appliedCoupon: orderPayload.appliedCoupon || null,
        shippingAddress: orderPayload.shippingAddress || matchingUser.address || null,
        placedAt: new Date().toISOString(),
      };

      const ordersData = await jsonStore.readJsonFileWithDefault("orders.json", []);
      ordersData.push(newOrder);
      await jsonStore.writeJsonFile("orders.json", ordersData);

      response.status(201).json(newOrder);
    } catch (error) {
      response.status(500).json({
        message: "Unable to place order",
        details: error.message,
      });
    }
  });

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
